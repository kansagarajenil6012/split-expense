import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import config from '../config/index.js';
import { getClient } from '../config/database.js';
import usersRepository from '../repositories/users.repository.js';
import userIdentitiesRepository from '../repositories/user-identities.repository.js';
import refreshTokensRepository from '../repositories/refresh-tokens.repository.js';
import { badRequest, conflict, unauthorized } from '../utils/app-error.js';
import { logAudit, getRequestMeta } from './audit.service.js';
import { verifyFirebaseToken } from './firebase.service.js';
import groupsService from './groups.service.js';

const googleClient = config.google.clientId
  ? new OAuth2Client(config.google.clientId)
  : null;

function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(num, 10) * multipliers[unit];
}

function generateTokens(userId) {
  const accessToken = jwt.sign({ sub: userId }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + parseExpiry(config.jwt.refreshExpiresIn));
  return { accessToken, refreshToken, expiresAt };
}

async function saveRefreshToken(userId, { refreshToken, expiresAt }, client = null) {
  return refreshTokensRepository.create(
    { userId, token: refreshToken, expiresAt },
    client
  );
}

const authService = {
  async register({ email, password, fullName }, req) {
    let user = await usersRepository.findByEmail(email);
    const passwordHash = await bcrypt.hash(password, 12);

    if (user) {
      if (user.is_active) {
        throw conflict('Email already registered');
      }

      // Shadow user exists! Claim and activate it
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `UPDATE users 
           SET password_hash = $1, full_name = $2, is_active = true, updated_at = NOW() 
           WHERE id = $3 
           RETURNING id, email, full_name, avatar_url, phone, default_currency, timezone, created_at`,
          [passwordHash, fullName, user.id]
        );
        user = rows[0];

        // Also update any pending invitations to accepted
        await client.query(
          `UPDATE group_invitations SET status = 'accepted', responded_at = NOW()
           WHERE invitee_user_id = $1 AND status = 'pending'`,
          [user.id]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      user = await usersRepository.create({ email, passwordHash, fullName });
    }

    await logAudit({
      ...getRequestMeta(req),
      actorUserId: user.id,
      action: 'user.register',
      entityType: 'user',
      entityId: user.id,
      afterState: { email: user.email, full_name: user.full_name },
    });

    const tokens = generateTokens(user.id);
    await saveRefreshToken(user.id, tokens);

    // Auto-accept any pending invitations for this new email
    await groupsService.processPendingInvitations(user, req).catch(console.error);

    return { user: usersRepository.toPublic(user), ...tokens };
  },

  async login({ email, password }, req) {
    const user = await usersRepository.findByEmail(email);
    if (!user || !user.password_hash) throw unauthorized('Invalid email or password');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw unauthorized('Invalid email or password');

    await usersRepository.updateLastLogin(user.id);
    const tokens = generateTokens(user.id);
    await saveRefreshToken(user.id, tokens);

    await logAudit({
      ...getRequestMeta(req),
      actorUserId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
    });

    return { user: usersRepository.toPublic(user), ...tokens };
  },

  async googleLogin({ idToken }, req) {
    if (!googleClient) throw badRequest('Google login not configured');

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let identity = await userIdentitiesRepository.findByProvider('google', googleId);
    let user;

    if (identity) {
      user = await usersRepository.findById(identity.user_id);
    } else {
      user = await usersRepository.findByEmail(email);
      const client = await getClient();
      try {
        await client.query('BEGIN');
        if (!user) {
          user = await usersRepository.create(
            { email, passwordHash: null, fullName: name, avatarUrl: picture },
            client
          );
        } else if (!user.is_active) {
          const { rows } = await client.query(
            `UPDATE users 
             SET is_active = true, full_name = $1, avatar_url = $2, updated_at = NOW() 
             WHERE id = $3 
             RETURNING id, email, full_name, avatar_url, phone, default_currency, timezone, created_at`,
            [name, picture, user.id]
          );
          user = rows[0];

          // Also update any pending invitations to accepted
          await client.query(
            `UPDATE group_invitations SET status = 'accepted', responded_at = NOW()
             WHERE invitee_user_id = $1 AND status = 'pending'`,
            [user.id]
          );
        }
        await userIdentitiesRepository.create(
          { userId: user.id, provider: 'google', providerUserId: googleId, providerEmail: email },
          client
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    await usersRepository.updateLastLogin(user.id);
    const tokens = generateTokens(user.id);
    await saveRefreshToken(user.id, tokens);

    await groupsService.processPendingInvitations(user, req).catch(console.error);

    return { user: usersRepository.toPublic(user), ...tokens };
  },

  async firebasePhoneLogin({ idToken }, req) {
    const decodedToken = await verifyFirebaseToken(idToken);
    const { phone_number, uid } = decodedToken;

    if (!phone_number) {
      throw badRequest('Firebase token does not contain a phone number');
    }

    let identity = await userIdentitiesRepository.findByProvider('firebase_phone', uid);
    let user;

    if (identity) {
      user = await usersRepository.findById(identity.user_id);
    } else {
      user = await usersRepository.findByPhone(phone_number);
      const client = await getClient();
      try {
        await client.query('BEGIN');
        if (!user) {
          user = await usersRepository.create(
            { email: null, passwordHash: null, fullName: phone_number, phone: phone_number },
            client
          );
        } else if (!user.is_active) {
          const { rows } = await client.query(
            `UPDATE users 
             SET is_active = true, full_name = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING id, email, full_name, avatar_url, phone, default_currency, timezone, created_at`,
            [phone_number, user.id]
          );
          user = rows[0];

          // Also update any pending invitations to accepted
          await client.query(
            `UPDATE group_invitations SET status = 'accepted', responded_at = NOW()
             WHERE invitee_user_id = $1 AND status = 'pending'`,
            [user.id]
          );
        }
        await userIdentitiesRepository.create(
          { userId: user.id, provider: 'firebase_phone', providerUserId: uid },
          client
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    await usersRepository.updateLastLogin(user.id);
    const tokens = generateTokens(user.id);
    await saveRefreshToken(user.id, tokens);

    await groupsService.processPendingInvitations(user, req).catch(console.error);

    return { user: usersRepository.toPublic(user), ...tokens };
  },

  async refresh(refreshToken) {
    const stored = await refreshTokensRepository.findValid(refreshToken);
    if (!stored || stored.deleted_at || !stored.is_active) {
      throw unauthorized('Invalid refresh token');
    }

    await refreshTokensRepository.revoke(refreshToken);
    const tokens = generateTokens(stored.user_id);
    await saveRefreshToken(stored.user_id, tokens);

    const user = await usersRepository.findById(stored.user_id);
    return { user: usersRepository.toPublic(user), ...tokens };
  },

  async logout(refreshToken) {
    if (refreshToken) await refreshTokensRepository.revoke(refreshToken);
  },

  async getMe(userId) {
    const user = await usersRepository.findById(userId);
    return usersRepository.toPublic(user);
  },
};

export default authService;
