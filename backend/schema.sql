
CREATE DATABASE IF NOT EXISTS anti_procrastination
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE anti_procrastination;

-- 用户表：与项目现有登录注册模块保持基本兼容
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- 专注记录表
CREATE TABLE IF NOT EXISTS focus_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    duration INT UNSIGNED NOT NULL COMMENT '专注时长，单位：分钟',
    start_time DATETIME DEFAULT NULL,
    end_time DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_focus_user_start (user_id, start_time),
    CONSTRAINT fk_focus_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- 每日打卡表
CREATE TABLE IF NOT EXISTS daily_checkins (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    checkin_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_checkin_user_date (user_id, checkin_date),
    CONSTRAINT fk_checkin_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


USE anti_procrastination;

CREATE TABLE IF NOT EXISTS supervision_relationships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    requester_id BIGINT UNSIGNED NOT NULL COMMENT '发起邀请的用户',
    receiver_id BIGINT UNSIGNED NOT NULL COMMENT '接收邀请的用户',
    status ENUM('pending', 'accepted', 'rejected')
        NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_supervision_requester (requester_id, status),
    KEY idx_supervision_receiver (receiver_id, status),
    CONSTRAINT fk_supervision_requester
        FOREIGN KEY (requester_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_supervision_receiver
        FOREIGN KEY (receiver_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_supervision_different_users
        CHECK (requester_id <> receiver_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;