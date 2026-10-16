/**
 * FOLK Damodar Month 2026 - Production-ready Express Server
 * Multi-user authentication, chanting tracker, community stats, admin panel, and SQLite backend.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use(express.json());
app.use(cookieParser());

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve project static files (both root and public directory)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Explicit static asset shortcuts
app.get('/damodar.png', (req, res) => {
  const filePath = path.join(__dirname, 'assets', 'damodar.png');
  res.sendFile(filePath);
});
app.get('/favicon.ico', (req, res) => {
  const filePath = path.join(__dirname, 'favicon.ico');
  res.sendFile(filePath);
});
app.get('/favicon.svg', (req, res) => {
  const filePath = path.join(__dirname, 'favicon.svg');
  res.type('image/svg+xml').sendFile(filePath);
});

/* ==========================================================================
   Rate Limiting (Brute-Force Protection)
   ========================================================================== */
const loginAttempts = new Map(); // key: ip + username -> { count, firstAttempt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip, username) {
  const key = `${ip}:${username.toLowerCase()}`;
  const record = loginAttempts.get(key);
  const now = Date.now();

  if (record) {
    if (now - record.firstAttempt > LOCKOUT_MS) {
      loginAttempts.delete(key);
      return { allowed: true };
    }
    if (record.count >= MAX_ATTEMPTS) {
      const waitMins = Math.ceil((LOCKOUT_MS - (now - record.firstAttempt)) / 60000);
      return { allowed: false, waitMins };
    }
  }
  return { allowed: true };
}

function recordFailedLogin(ip, username) {
  const key = `${ip}:${username.toLowerCase()}`;
  const record = loginAttempts.get(key);
  const now = Date.now();

  if (record) {
    record.count += 1;
  } else {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  }
}

function clearRateLimit(ip, username) {
  const key = `${ip}:${username.toLowerCase()}`;
  loginAttempts.delete(key);
}

/* ==========================================================================
   Authentication & Authorization Middlewares
   ========================================================================== */
function authenticateUser(req, res, next) {
  const token = req.cookies.folk_session || 
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
      ? req.headers.authorization.slice(7) 
      : null);

  if (!token) {
    req.user = null;
    return next();
  }

  const now = Date.now();
  const sessionStmt = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.role, u.residence, u.personal_goal, u.must_change_password, u.is_active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `);

  const session = sessionStmt.get(token, now);

  if (!session || session.is_active !== 1) {
    req.user = null;
    return next();
  }

  req.user = {
    id: session.id,
    username: session.username,
    full_name: session.full_name,
    role: session.role,
    residence: session.residence || 'FOLK PDEU',
    personal_goal: session.personal_goal,
    must_change_password: Boolean(session.must_change_password)
  };
  req.sessionToken = token;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

app.use(authenticateUser);

/* ==========================================================================
   Helper: Audit Logging
   ========================================================================== */
function logAudit(userId, actorName, action, targetType, targetId, details, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, actor_name, action, target_type, target_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId || null, actorName || 'System', action, targetType, String(targetId || ''), details, String(ip), new Date().toISOString());
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

/* ==========================================================================
   AUTH API ENDPOINTS
   ========================================================================== */

// 1. Register Resident
app.post('/api/auth/register', (req, res) => {
  try {
    const { full_name, username, password, personal_goal, residence } = req.body;

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid full name (minimum 2 characters).' });
    }

    const cleanUsername = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-24 characters and contain only letters, numbers, or underscores.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const goalNum = parseInt(personal_goal, 10) || 496;
    if (goalNum < 16 || goalNum > 100000) {
      return res.status(400).json({ error: 'Personal goal must be between 16 and 100,000 rounds.' });
    }

    const allowedResidences = ['FOLK PDEU', 'FOLK INFOCITY'];
    const cleanResidence = allowedResidences.includes(residence) ? residence : 'FOLK PDEU';

    // Check duplicate username
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'This username is already taken. Please choose another.' });
    }

    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, residence, personal_goal, must_change_password, is_active, created_at)
      VALUES (?, ?, ?, 'resident', ?, ?, 0, 1, ?)
    `);
    const result = insertUser.run(cleanUsername, passwordHash, full_name.trim(), cleanResidence, goalNum, now);
    const newUserId = result.lastInsertRowid;

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, newUserId, expiresAt, now);

    res.cookie('folk_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: false // true if HTTPS in production
    });

    logAudit(newUserId, full_name.trim(), 'USER_REGISTERED', 'users', newUserId, `New resident registered: ${cleanUsername} (${cleanResidence})`, req);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: Number(newUserId),
        username: cleanUsername,
        full_name: full_name.trim(),
        role: 'resident',
        residence: cleanResidence,
        personal_goal: goalNum,
        must_change_password: false
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Server error during registration. Please try again.' });
  }
});

// 2. Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Rate Limit Check
    const rateCheck = checkRateLimit(ip, cleanUsername);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        error: `Too many failed login attempts. Please wait ${rateCheck.waitMins} minute(s) before trying again.` 
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);

    if (!user) {
      recordFailedLogin(ip, cleanUsername);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the FOLK administrator.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      recordFailedLogin(ip, cleanUsername);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    clearRateLimit(ip, cleanUsername);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const now = new Date().toISOString();

    db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, user.id, expiresAt, now);

    res.cookie('folk_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: false
    });

    logAudit(user.id, user.full_name, 'USER_LOGIN', 'users', user.id, `User logged in: ${cleanUsername}`, req);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        residence: user.residence || 'FOLK PDEU',
        personal_goal: user.personal_goal,
        must_change_password: Boolean(user.must_change_password)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login. Please try again.' });
  }
});

// 3. Current User Session Check
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }
  return res.json({ authenticated: true, user: req.user });
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
  if (req.sessionToken) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  }
  res.clearCookie('folk_session');
  return res.json({ success: true, message: 'Successfully logged out.' });
});

// 5. Change Password (Forced Admin Setup or Resident Change)
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = db.prepare('SELECT password_hash, must_change_password FROM users WHERE id = ?').get(req.user.id);
    
    // Check current password
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    const salt = bcrypt.genSaltSync(12);
    const newHash = bcrypt.hashSync(new_password, salt);

    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, req.user.id);

    logAudit(req.user.id, req.user.full_name, 'PASSWORD_CHANGED', 'users', req.user.id, 'Password updated successfully', req);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Could not change password.' });
  }
});

/* ==========================================================================
   Helper: Daily Chanting Streak Calculation
   ========================================================================== */
function calculateStreak(dates) {
  if (!dates || dates.length === 0) return 0;

  const dateSet = new Set(dates);
  const now = new Date();

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayStr = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  let streak = 0;
  let cursor;

  if (dateSet.has(todayStr)) {
    cursor = new Date(now);
  } else if (dateSet.has(yesterdayStr)) {
    cursor = new Date(yesterday);
  } else {
    return 0;
  }

  while (dateSet.has(formatDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/* ==========================================================================
   COMMUNITY DASHBOARD APIS (Public / Authenticated)
   ========================================================================== */

app.get('/api/community/stats', (req, res) => {
  try {
    // Read Settings
    const settingsRows = db.prepare('SELECT key, value FROM tracker_settings').all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = r.value);

    const targetRounds = parseInt(settings.community_target, 10) || 10008;
    const targetPdeu = parseInt(settings.target_folk_pdeu, 10) || 5004;
    const targetInfocity = parseInt(settings.target_folk_infocity, 10) || 5004;
    const startDate = settings.campaign_start_date || '2026-10-25';
    const endDate = settings.campaign_end_date || '2026-11-24';

    // Total Collective Rounds
    const totalRow = db.prepare('SELECT COALESCE(SUM(rounds), 0) as total FROM chanting_entries').get();
    const totalRounds = totalRow.total;

    // Per-Center Rounds (PDEU, INFOCITY, None)
    const pdeuRow = db.prepare(`
      SELECT COALESCE(SUM(e.rounds), 0) as total 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE u.residence = 'FOLK PDEU'
    `).get();
    const pdeuRounds = pdeuRow.total;

    const infocityRow = db.prepare(`
      SELECT COALESCE(SUM(e.rounds), 0) as total 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE u.residence = 'FOLK INFOCITY'
    `).get();
    const infocityRounds = infocityRow.total;

    // Active Participants per center
    const pdeuActiveRow = db.prepare(`
      SELECT COUNT(DISTINCT e.user_id) as count 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE u.residence = 'FOLK PDEU' AND u.is_active = 1
    `).get();
    const pdeuActive = pdeuActiveRow.count;

    const infocityActiveRow = db.prepare(`
      SELECT COUNT(DISTINCT e.user_id) as count 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE u.residence = 'FOLK INFOCITY' AND u.is_active = 1
    `).get();
    const infocityActive = infocityActiveRow.count;

    // Today's Date
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRow = db.prepare('SELECT COALESCE(SUM(rounds), 0) as total FROM chanting_entries WHERE date = ?').get(todayStr);
    const todayRounds = todayRow.total;

    const todayPdeuRow = db.prepare(`
      SELECT COALESCE(SUM(e.rounds), 0) as total 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE u.residence = 'FOLK PDEU' AND e.date = ?
    `).get(todayStr);
    const todayPdeuRounds = todayPdeuRow ? todayPdeuRow.total : 0;

    const todayInfocityRow = db.prepare(`
      SELECT COALESCE(SUM(e.rounds), 0) as total 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE u.residence = 'FOLK INFOCITY' AND e.date = ?
    `).get(todayStr);
    const todayInfocityRounds = todayInfocityRow ? todayInfocityRow.total : 0;

    // Number of Participating Residents (active)
    const participantsRow = db.prepare(`
      SELECT COUNT(DISTINCT e.user_id) as count 
      FROM chanting_entries e
      JOIN users u ON e.user_id = u.id
      WHERE u.is_active = 1
    `).get();
    const activeParticipants = participantsRow.count;

    // Total registered active residents
    const totalResidentsRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'resident' AND is_active = 1").get();
    const totalResidents = totalResidentsRow.count;

    // Fetch distinct active dates for all users to calculate accurate streaks
    const allUserDates = db.prepare('SELECT user_id, date FROM chanting_entries GROUP BY user_id, date').all();
    const userDatesMap = {};
    allUserDates.forEach(r => {
      if (!userDatesMap[r.user_id]) userDatesMap[r.user_id] = [];
      userDatesMap[r.user_id].push(r.date);
    });

    // Leaderboard
    const leaderboardStmt = db.prepare(`
      SELECT 
        u.id as user_id,
        u.full_name,
        u.username,
        u.residence,
        u.personal_goal,
        COALESCE(SUM(e.rounds), 0) as total_rounds,
        COUNT(DISTINCT e.date) as active_days,
        MAX(e.date) as last_chanted_date
      FROM users u
      LEFT JOIN chanting_entries e ON u.id = e.user_id
      WHERE u.role = 'resident' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY total_rounds DESC, u.full_name ASC
    `);
    const leaderboardRaw = leaderboardStmt.all();

    const leaderboard = leaderboardRaw.map((dev, idx) => ({
      rank: idx + 1,
      user_id: dev.user_id,
      full_name: dev.full_name,
      username: dev.username,
      residence: dev.residence || 'FOLK PDEU',
      streak: calculateStreak(userDatesMap[dev.user_id] || []),
      total_rounds: dev.total_rounds,
      active_days: dev.active_days,
      last_chanted_date: dev.last_chanted_date,
      contribution_pct: totalRounds > 0 ? ((dev.total_rounds / totalRounds) * 100).toFixed(1) : '0.0'
    }));

    // Lamps count
    const lampCountRow = db.prepare('SELECT COUNT(*) as count FROM lamp_offerings').get();

    return res.json({
      target_rounds: targetRounds,
      target_pdeu: targetPdeu,
      target_infocity: targetInfocity,
      campaign_start_date: startDate,
      campaign_end_date: endDate,
      total_rounds: totalRounds,
      pdeu_rounds: pdeuRounds,
      infocity_rounds: infocityRounds,
      pdeu_percentage: Math.min(100, (pdeuRounds / targetPdeu) * 100).toFixed(1),
      infocity_percentage: Math.min(100, (infocityRounds / targetInfocity) * 100).toFixed(1),
      pdeu_active: pdeuActive,
      infocity_active: infocityActive,
      today_rounds: todayRounds,
      today_pdeu_rounds: todayPdeuRounds,
      today_infocity_rounds: todayInfocityRounds,
      active_participants: activeParticipants,
      total_residents: totalResidents,
      percentage: Math.min(100, (totalRounds / targetRounds) * 100).toFixed(1),
      avg_per_active_devotee: activeParticipants > 0 ? Math.round(totalRounds / activeParticipants) : 0,
      leaderboard,
      lamps_offered: lampCountRow.count
    });
  } catch (err) {
    console.error('Community stats error:', err);
    return res.status(500).json({ error: 'Could not fetch community statistics.' });
  }
});

// Offer Deepam / Lamp
app.post('/api/lamps/offer', (req, res) => {
  try {
    const devoteeName = (req.body.devotee_name || (req.user ? req.user.full_name : 'A FOLK Boy')).trim();
    const userId = req.user ? req.user.id : null;
    const now = new Date().toISOString();

    db.prepare('INSERT INTO lamp_offerings (user_id, devotee_name, created_at) VALUES (?, ?, ?)').run(userId, devoteeName, now);

    const countRow = db.prepare('SELECT COUNT(*) as count FROM lamp_offerings').get();
    return res.json({ success: true, lamps_offered: countRow.count, devotee_name: devoteeName });
  } catch (err) {
    return res.status(500).json({ error: 'Could not record lamp offering.' });
  }
});

/* ==========================================================================
   INDIVIDUAL RESIDENT DASHBOARD APIS
   ========================================================================== */

// 1. Get Individual Dashboard Data
app.get('/api/user/dashboard', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;

    // User's total rounds
    const userTotalRow = db.prepare('SELECT COALESCE(SUM(rounds), 0) as total FROM chanting_entries WHERE user_id = ?').get(userId);
    const userTotal = userTotalRow.total;

    // Community Total
    const communityTotalRow = db.prepare('SELECT COALESCE(SUM(rounds), 0) as total FROM chanting_entries').get();
    const communityTotal = communityTotalRow.total;

    // Contribution %
    const contributionPct = communityTotal > 0 ? ((userTotal / communityTotal) * 100).toFixed(1) : '0.0';

    // Personal Goal
    const userRow = db.prepare('SELECT personal_goal, full_name, username, residence FROM users WHERE id = ?').get(userId);
    const personalGoal = userRow.personal_goal || 496;
    const personalProgressPct = Math.min(100, (userTotal / personalGoal) * 100).toFixed(1);

    // Today's Rounds for this user
    const todayStr = new Date().toISOString().split('T')[0];
    const userTodayRow = db.prepare('SELECT COALESCE(SUM(rounds), 0) as total FROM chanting_entries WHERE user_id = ? AND date = ?').get(userId, todayStr);

    // User's Entries History & Streak
    const entries = db.prepare(`
      SELECT id, date, rounds, notes, created_at, updated_at
      FROM chanting_entries
      WHERE user_id = ?
      ORDER BY date DESC, id DESC
    `).all(userId);

    const userDistinctDates = db.prepare('SELECT DISTINCT date FROM chanting_entries WHERE user_id = ? ORDER BY date DESC').all(userId).map(r => r.date);
    const userStreak = calculateStreak(userDistinctDates);

    return res.json({
      profile: {
        id: userId,
        full_name: userRow.full_name,
        username: userRow.username,
        residence: userRow.residence || 'FOLK PDEU',
        personal_goal: personalGoal
      },
      stats: {
        total_rounds: userTotal,
        today_rounds: userTodayRow.total,
        current_streak: userStreak,
        personal_goal: personalGoal,
        personal_progress_pct: personalProgressPct,
        contribution_pct: contributionPct,
        total_entries_logged: entries.length
      },
      entries
    });
  } catch (err) {
    console.error('Resident dashboard error:', err);
    return res.status(500).json({ error: 'Could not fetch resident dashboard data.' });
  }
});

// 2. Submit Daily Chanting Rounds
app.post('/api/user/entries', requireAuth, (req, res) => {
  try {
    const { date, rounds, notes } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Please provide a valid date in YYYY-MM-DD format.' });
    }

    const roundsNum = parseInt(rounds, 10);
    if (!roundsNum || roundsNum <= 0 || roundsNum > 192) {
      return res.status(400).json({ error: 'Rounds must be a positive number between 1 and 192.' });
    }

    const cleanNotes = String(notes || '').trim().slice(0, 200);
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO chanting_entries (user_id, date, rounds, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(req.user.id, date, roundsNum, cleanNotes, now, now);

    logAudit(req.user.id, req.user.full_name, 'ENTRY_CREATED', 'chanting_entries', result.lastInsertRowid, `Logged ${roundsNum} rounds for date ${date}`, req);

    return res.status(201).json({
      success: true,
      message: `${roundsNum} rounds successfully recorded!`,
      entry: {
        id: Number(result.lastInsertRowid),
        date,
        rounds: roundsNum,
        notes: cleanNotes,
        created_at: now
      }
    });
  } catch (err) {
    console.error('Submit entry error:', err);
    return res.status(500).json({ error: 'Failed to record chanting rounds.' });
  }
});

// 3. Update/Correct Own Entry
app.put('/api/user/entries/:id', requireAuth, (req, res) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const { rounds, date, notes } = req.body;

    // Verify ownership
    const existing = db.prepare('SELECT * FROM chanting_entries WHERE id = ? AND user_id = ?').get(entryId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found or you do not have permission to edit this record.' });
    }

    const roundsNum = parseInt(rounds, 10);
    if (!roundsNum || roundsNum <= 0 || roundsNum > 192) {
      return res.status(400).json({ error: 'Rounds must be a positive number between 1 and 192.' });
    }

    const cleanDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : existing.date;
    const cleanNotes = notes !== undefined ? String(notes).trim().slice(0, 200) : existing.notes;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE chanting_entries 
      SET rounds = ?, date = ?, notes = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(roundsNum, cleanDate, cleanNotes, now, entryId, req.user.id);

    logAudit(req.user.id, req.user.full_name, 'ENTRY_UPDATED_BY_RESIDENT', 'chanting_entries', entryId, `Corrected rounds from ${existing.rounds} to ${roundsNum} (date: ${cleanDate})`, req);

    return res.json({ success: true, message: 'Record updated successfully.' });
  } catch (err) {
    console.error('Update entry error:', err);
    return res.status(500).json({ error: 'Failed to update record.' });
  }
});

// 4. Delete Own Entry
app.delete('/api/user/entries/:id', requireAuth, (req, res) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM chanting_entries WHERE id = ? AND user_id = ?').get(entryId, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found or unauthorized.' });
    }

    db.prepare('DELETE FROM chanting_entries WHERE id = ? AND user_id = ?').run(entryId, req.user.id);

    logAudit(req.user.id, req.user.full_name, 'ENTRY_DELETED_BY_RESIDENT', 'chanting_entries', entryId, `Deleted entry of ${existing.rounds} rounds on ${existing.date}`, req);

    return res.json({ success: true, message: 'Record removed successfully.' });
  } catch (err) {
    console.error('Delete entry error:', err);
    return res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// 5. Update Personal Goal & Profile
app.post('/api/user/profile', requireAuth, (req, res) => {
  try {
    const { full_name, personal_goal } = req.body;

    const goalNum = parseInt(personal_goal, 10);
    if (!goalNum || goalNum < 16 || goalNum > 100000) {
      return res.status(400).json({ error: 'Personal goal must be between 16 and 100,000 rounds.' });
    }

    const cleanName = full_name && typeof full_name === 'string' && full_name.trim().length >= 2 ? full_name.trim() : req.user.full_name;

    db.prepare('UPDATE users SET full_name = ?, personal_goal = ? WHERE id = ?').run(cleanName, goalNum, req.user.id);

    logAudit(req.user.id, cleanName, 'PROFILE_UPDATED', 'users', req.user.id, `Goal set to ${goalNum}`, req);

    return res.json({ success: true, message: 'Profile updated successfully.', full_name: cleanName, personal_goal: goalNum });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/* ==========================================================================
   ADMIN DASHBOARD APIS (Protected by requireAdmin)
   ========================================================================== */

// 1. Admin Overview
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  try {
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'resident'").get().count;
    const activeUsersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'resident' AND is_active = 1").get().count;
    const entriesCount = db.prepare("SELECT COUNT(*) as count FROM chanting_entries").get().count;
    const totalRounds = db.prepare("SELECT COALESCE(SUM(rounds), 0) as total FROM chanting_entries").get().total;

    return res.json({
      total_residents: usersCount,
      active_residents: activeUsersCount,
      total_entries: entriesCount,
      total_rounds: totalRounds
    });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch admin overview.' });
  }
});

// 2. Admin: View & Manage All Residents
app.get('/api/admin/residents', requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.role,
        u.residence,
        u.personal_goal,
        u.is_active,
        u.created_at,
        COALESCE(SUM(e.rounds), 0) as total_rounds,
        COUNT(e.id) as total_submissions
      FROM users u
      LEFT JOIN chanting_entries e ON u.id = e.user_id
      WHERE u.role = 'resident'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    const residentsRaw = stmt.all();

    const allUserDates = db.prepare('SELECT user_id, date FROM chanting_entries GROUP BY user_id, date').all();
    const userDatesMap = {};
    allUserDates.forEach(r => {
      if (!userDatesMap[r.user_id]) userDatesMap[r.user_id] = [];
      userDatesMap[r.user_id].push(r.date);
    });

    const residents = residentsRaw.map(r => ({
      ...r,
      streak: calculateStreak(userDatesMap[r.id] || [])
    }));

    return res.json({ residents });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch residents list.' });
  }
});

// 3. Admin: Toggle Resident Active Status (Deactivate duplicate or unauthorized)
app.post('/api/admin/residents/:id/toggle-status', requireAdmin, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own administrator account.' });
    }

    const user = db.prepare('SELECT id, username, full_name, is_active FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newStatus = user.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, targetUserId);

    // If deactivated, invalidate all active sessions
    if (newStatus === 0) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
    }

    const actionText = newStatus === 1 ? 'ACTIVATED' : 'DEACTIVATED';
    logAudit(req.user.id, req.user.full_name, `RESIDENT_${actionText}`, 'users', targetUserId, `Admin ${actionText.toLowerCase()} resident: ${user.username}`, req);

    return res.json({ success: true, is_active: newStatus, message: `Account ${actionText.toLowerCase()} successfully.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle account status.' });
  }
});

// 4. Admin: View All Chanting Entries with Details
app.get('/api/admin/entries', requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        e.id,
        e.user_id,
        e.date,
        e.rounds,
        e.notes,
        e.created_at,
        e.updated_at,
        u.username,
        u.full_name
      FROM chanting_entries e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.date DESC, e.id DESC
      LIMIT 500
    `);
    const entries = stmt.all();
    return res.json({ entries });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load entries for moderation.' });
  }
});

// 5. Admin: Moderate/Edit Entry
app.put('/api/admin/entries/:id', requireAdmin, (req, res) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const { rounds, date, reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ error: 'An administrative reason is required for moderating records.' });
    }

    const existing = db.prepare(`
      SELECT e.*, u.full_name, u.username 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE e.id = ?
    `).get(entryId);

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const roundsNum = parseInt(rounds, 10);
    if (!roundsNum || roundsNum <= 0 || roundsNum > 192) {
      return res.status(400).json({ error: 'Rounds must be between 1 and 192.' });
    }

    const cleanDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : existing.date;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE chanting_entries 
      SET rounds = ?, date = ?, updated_at = ?
      WHERE id = ?
    `).run(roundsNum, cleanDate, now, entryId);

    logAudit(req.user.id, req.user.full_name, 'ADMIN_MODERATED_ENTRY', 'chanting_entries', entryId, `Modified rounds for ${existing.username} from ${existing.rounds} to ${roundsNum}. Reason: ${reason.trim()}`, req);

    return res.json({ success: true, message: 'Record moderated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to moderate record.' });
  }
});

// 6. Admin: Delete Entry
app.delete('/api/admin/entries/:id', requireAdmin, (req, res) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const reason = String(req.body.reason || req.query.reason || '').trim();

    if (!reason || reason.length < 3) {
      return res.status(400).json({ error: 'An administrative reason is required to delete records.' });
    }

    const existing = db.prepare(`
      SELECT e.*, u.full_name, u.username 
      FROM chanting_entries e 
      JOIN users u ON e.user_id = u.id 
      WHERE e.id = ?
    `).get(entryId);

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    db.prepare('DELETE FROM chanting_entries WHERE id = ?').run(entryId);

    logAudit(req.user.id, req.user.full_name, 'ADMIN_DELETED_ENTRY', 'chanting_entries', entryId, `Deleted ${existing.rounds} rounds of ${existing.username} on ${existing.date}. Reason: ${reason}`, req);

    return res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// 7. Admin: Update Tracker Settings
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const { community_target, target_folk_pdeu, target_folk_infocity, campaign_start_date, campaign_end_date } = req.body;
    const now = new Date().toISOString();

    const updateStmt = db.prepare('INSERT OR REPLACE INTO tracker_settings (key, value, updated_at) VALUES (?, ?, ?)');

    if (community_target) {
      const targetNum = parseInt(community_target, 10);
      if (targetNum > 0) {
        updateStmt.run('community_target', String(targetNum), now);
      }
    }

    if (target_folk_pdeu) {
      const pdeuNum = parseInt(target_folk_pdeu, 10);
      if (pdeuNum > 0) {
        updateStmt.run('target_folk_pdeu', String(pdeuNum), now);
      }
    }

    if (target_folk_infocity) {
      const infocityNum = parseInt(target_folk_infocity, 10);
      if (infocityNum > 0) {
        updateStmt.run('target_folk_infocity', String(infocityNum), now);
      }
    }

    if (campaign_start_date && /^\d{4}-\d{2}-\d{2}$/.test(campaign_start_date)) {
      updateStmt.run('campaign_start_date', campaign_start_date, now);
    }

    if (campaign_end_date && /^\d{4}-\d{2}-\d{2}$/.test(campaign_end_date)) {
      updateStmt.run('campaign_end_date', campaign_end_date, now);
    }

    logAudit(req.user.id, req.user.full_name, 'SETTINGS_UPDATED', 'tracker_settings', 'all', `Target: ${community_target}, PDEU: ${target_folk_pdeu}, INFOCITY: ${target_folk_infocity}, Start: ${campaign_start_date}, End: ${campaign_end_date}`, req);

    return res.json({ success: true, message: 'Tracker settings updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// 8. Admin: View Audit Logs
app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT id, user_id, actor_name, action, target_type, target_id, details, ip_address, created_at
      FROM audit_logs
      ORDER BY id DESC
      LIMIT 200
    `).all();
    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// 9. Admin: Export CSV
app.get('/api/admin/export-csv', requireAdmin, (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT 
        e.id as entry_id,
        u.full_name,
        u.username,
        u.residence,
        e.date,
        e.rounds,
        e.notes,
        e.created_at,
        e.updated_at
      FROM chanting_entries e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.date ASC, e.id ASC
    `).all();

    let csv = 'Entry ID,Devotee Full Name,Username,Residence,Date,Rounds Chanted,Notes,Logged At,Last Updated\n';
    
    entries.forEach(row => {
      const cleanNotes = (row.notes || '').replace(/"/g, '""');
      const cleanName = (row.full_name || '').replace(/"/g, '""');
      const cleanResidence = (row.residence || 'FOLK PDEU').replace(/"/g, '""');
      csv += `${row.entry_id},"${cleanName}","${row.username}","${cleanResidence}","${row.date}",${row.rounds},"${cleanNotes}","${row.created_at}","${row.updated_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="folk-damodar-2026-chanting-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('CSV Export error:', err);
    return res.status(500).send('Error generating CSV export.');
  }
});

// Fallback: only serve index.html for page routes (HTML navigation), never for missing static assets or missing API endpoints!
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `API endpoint ${req.path} not found` });
  }
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|json|woff2?|ttf|eot)$/i)) {
    return res.status(404).send('Asset not found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server locally if run directly
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌸 FOLK Damodar Month 2026 Multi-User Chanting Tracker`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
