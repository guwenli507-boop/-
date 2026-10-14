-- Fresh-database initialization example only.
-- Do NOT run this against an existing database before inspecting its users
-- table. Existing deployments must make tasks.user_id match the exact type,
-- length, and UNSIGNED attribute of their existing users.id.

CREATE DATABASE IF NOT EXISTS anti_procrastination
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE anti_procrastination;

-- This users definition is a recommendation for a fresh database only.
-- It is not a migration for an existing users table.
CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Here user_id matches the users.id type above. If users already exists with
-- another type, adjust user_id to match before creating tasks and adding its FK.
CREATE TABLE tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    due_date DATE NULL,
    is_completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_user_created (user_id, created_at),
    CONSTRAINT fk_tasks_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
