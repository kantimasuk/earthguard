-- ============================================================
-- It's All Rights: EarthGuard — MySQL schema (Demo)
-- ใช้กับ MySQL 8 บน Railway   |   รัน: cd server && npm run db:init
-- เวลาทั้งหมดเก็บเป็น UTC
-- ============================================================
SET NAMES utf8mb4;

-- ---------- บัญชีผู้ใช้ ----------
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firebase_uid    VARCHAR(128) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  display_name    VARCHAR(40)  NOT NULL,
  photo_url       VARCHAR(1024) NULL,
  auth_providers  VARCHAR(100) NOT NULL DEFAULT '',     -- เช่น "password,google.com"
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at   DATETIME NULL,
  UNIQUE KEY uq_users_uid (firebase_uid),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ลิงก์รีเซ็ตรหัสผ่าน: อายุ 30 นาที ใช้ได้ครั้งเดียว (เก็บเฉพาะ hash ของ token)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firebase_uid  VARCHAR(128) NOT NULL,
  token_hash    CHAR(64) NOT NULL,
  expires_at    DATETIME NOT NULL,
  used_at       DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reset_hash (token_hash),
  KEY idx_reset_uid (firebase_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ข้อมูลตั้งต้น (seed จาก Excel) ----------
CREATE TABLE IF NOT EXISTS questions (
  id           INT UNSIGNED PRIMARY KEY,
  bank         VARCHAR(20)  NOT NULL DEFAULT 'pre_post',
  category     VARCHAR(40)  NULL,
  category_th  VARCHAR(80)  NULL,
  question     TEXT NOT NULL,
  answer       TINYINT(1) NOT NULL,          -- 1 = ถูก, 0 = ผิด
  explanation  TEXT NULL,
  source       VARCHAR(255) NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cards (
  code            VARCHAR(20) PRIMARY KEY,   -- เช่น R-AIR-01
  design_code     VARCHAR(20) NOT NULL,
  type            ENUM('right','activity','threat','end') NOT NULL,
  subtype         VARCHAR(64) NULL,
  name            VARCHAR(120) NOT NULL,
  short_name      VARCHAR(60) NULL,
  body_text       TEXT NULL,
  number          TINYINT NULL,
  number_meaning  VARCHAR(60) NULL,
  symbol          VARCHAR(60) NULL,
  build_condition VARCHAR(255) NULL,
  points          TINYINT NULL,
  ability         TEXT NULL,
  protects_or_protected_by VARCHAR(255) NULL,
  discard_count   TINYINT NULL,
  deck_phase      VARCHAR(80) NULL,
  color_hex       CHAR(7) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- รอบการเล่น ----------
-- ถ้าผู้เล่นกด "ออกจากเกม" ให้ DELETE แถวนี้ → ข้อมูลลูกทั้งหมดถูกลบตาม (ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS game_sessions (
  id           CHAR(36) PRIMARY KEY,         -- UUID
  user_id      INT UNSIGNED NOT NULL,
  mode         ENUM('single','multi','practice') NOT NULL DEFAULT 'single',
  difficulty   ENUM('easy','medium','hard') NOT NULL,
  ai_count     TINYINT NOT NULL,
  status       ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  started_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at     DATETIME NULL,
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อสอบ 5 ข้อที่สุ่มให้รอบการเล่นนี้ (Pre-test และ Post-test ใช้ชุดเดียวกัน)
CREATE TABLE IF NOT EXISTS session_questions (
  session_id   CHAR(36) NOT NULL,
  order_no     TINYINT NOT NULL,             -- ข้อที่ 1–5
  question_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (session_id, order_no),
  CONSTRAINT fk_sq_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sq_question FOREIGN KEY (question_id) REFERENCES questions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_attempts (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id     CHAR(36) NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  phase          ENUM('pre','post') NOT NULL,
  score          TINYINT NOT NULL,
  total          TINYINT NOT NULL,
  time_used_sec  SMALLINT NOT NULL,
  timed_out      TINYINT(1) NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attempt (session_id, phase),
  CONSTRAINT fk_attempt_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_answers (
  attempt_id   INT UNSIGNED NOT NULL,
  order_no     TINYINT NOT NULL,
  question_id  INT UNSIGNED NOT NULL,
  user_answer  TINYINT(1) NULL,              -- NULL = ไม่ได้ตอบ (หมดเวลา) นับเป็นผิด
  is_correct   TINYINT(1) NOT NULL,
  PRIMARY KEY (attempt_id, order_no),
  CONSTRAINT fk_answer_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_answer_question FOREIGN KEY (question_id) REFERENCES questions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_players (
  session_id     CHAR(36) NOT NULL,
  seat           TINYINT NOT NULL,           -- ลำดับตา (0 = คนแรก)
  is_ai          TINYINT(1) NOT NULL,
  user_id        INT UNSIGNED NULL,
  display_name   VARCHAR(40) NOT NULL,
  rights_points  SMALLINT NOT NULL DEFAULT 0,
  bonus_points   SMALLINT NOT NULL DEFAULT 0,
  coin_penalty   SMALLINT NOT NULL DEFAULT 0,
  cards_left     SMALLINT NOT NULL DEFAULT 0,
  protect_count  SMALLINT NOT NULL DEFAULT 0, -- ใช้ตัดสินกรณีคะแนนเท่ากัน
  total_points   SMALLINT NOT NULL DEFAULT 0,
  final_rank     TINYINT NULL,
  PRIMARY KEY (session_id, seat),
  CONSTRAINT fk_player_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  CHAR(36) NOT NULL,
  seq         INT NOT NULL,
  turn_no     INT NOT NULL,
  game_phase  TINYINT NOT NULL,              -- ช่วงที่ 1/2/3
  actor_seat  TINYINT NULL,                  -- NULL = ระบบ
  action      VARCHAR(40) NOT NULL,          -- take_row, build_right, threat, coin_choice, lose_cards, phase_change, peek, auto_action, game_end
  payload     JSON NULL,
  is_public   TINYINT(1) NOT NULL DEFAULT 1, -- 0 = เปิดเผยหลังจบเกมเท่านั้น
  is_auto     TINYINT(1) NOT NULL DEFAULT 0, -- 1 = ระบบทำแทนเพราะหมดเวลา
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_log_seq (session_id, seq),
  CONSTRAINT fk_log_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
