require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createHash } = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;
const LEGACY_PREHASH_PREFIX = "sha256-bcrypt:";

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET, "utf8") < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

const app = express();

app.use(cors());
app.use(express.json());

async function hashPassword(password) {
    let passwordInput = password;
    let prefix = "";

    if (Buffer.byteLength(password, "utf8") > 72) {
        passwordInput = createHash("sha256").update(password, "utf8").digest("hex");
        prefix = LEGACY_PREHASH_PREFIX;
    }

    return prefix + await bcrypt.hash(passwordInput, 12);
}

// ====================
// MySQL 数据库连接
// ====================
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "anti_procrastination",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ====================
// 测试数据库连接
// ====================
async function testDatabase() {
    try {
        const connection = await db.getConnection();
        console.log("MySQL 数据库连接成功！");
        connection.release();
    } catch (error) {
        console.error("MySQL 数据库连接失败：", error.message);
    }
}

testDatabase();

// ====================
// 首页
// ====================
app.get("/", (req, res) => {
    res.json({
        message: "大学生反拖延监督系统后端运行成功！"
    });
});

// 用户注册
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body || {};

    if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string" ||
        !password
    ) {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    if (Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({
            message: "密码长度不能超过 72 字节"
        });
    }

    try {
        const [existingUsers] = await db.execute(
            "SELECT id FROM users WHERE username = ?",
            [username.trim()]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                message: "用户名已经存在"
            });
        }

        const passwordHash = await hashPassword(password);
        await db.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username.trim(), passwordHash]
        );

        res.json({
            message: "注册成功"
        });

    } catch (error) {
        respondDatabaseError(res, "注册失败", error);
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body || {};

    if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string" ||
        !password
    ) {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    try {
        const [users] = await db.execute(
            "SELECT id, password FROM users WHERE username = ?",
            [username.trim()]
        );
        const user = users[0];

        if (!user) {
            return res.status(401).json({
                message: "用户名或密码错误"
            });
        }

        const storedPassword = String(user.password);
        const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);
        const isPrehashedLegacyPassword = storedPassword.startsWith(LEGACY_PREHASH_PREFIX);
        let passwordMatches;

        if (isPrehashedLegacyPassword) {
            const passwordDigest = createHash("sha256").update(password, "utf8").digest("hex");
            passwordMatches = await bcrypt.compare(
                passwordDigest,
                storedPassword.slice(LEGACY_PREHASH_PREFIX.length)
            );
        } else if (isBcryptHash) {
            passwordMatches = await bcrypt.compare(password, storedPassword);
        } else {
            passwordMatches = password === storedPassword;
        }

        if (!passwordMatches) {
            return res.status(401).json({
                message: "用户名或密码错误"
            });
        }

        if (!isBcryptHash && !isPrehashedLegacyPassword) {
            const passwordHash = await hashPassword(password);
            await db.execute(
                "UPDATE users SET password = ? WHERE id = ?",
                [passwordHash, user.id]
            );
        }

        const token = jwt.sign(
            { sub: String(user.id) },
            JWT_SECRET,
            { algorithm: "HS256", expiresIn: "1h" }
        );

        res.json({
            token,
            tokenType: "Bearer",
            expiresIn: 3600
        });
    } catch (error) {
        respondDatabaseError(res, "登录失败", error);
    }
});

function requireAuth(req, res, next) {
    const authorization = req.get("Authorization");
    const match = authorization && authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
        return res.status(401).json({
            message: "需要提供有效的 Bearer Token"
        });
    }

    try {
        const payload = jwt.verify(match[1], JWT_SECRET, {
            algorithms: ["HS256"]
        });

        if (
            typeof payload !== "object" ||
            typeof payload.sub !== "string" ||
            !payload.sub
        ) {
            return res.status(401).json({
                message: "Token 无效"
            });
        }

        req.userId = payload.sub;
        next();
    } catch {
        return res.status(401).json({
            message: "Token 无效或已过期"
        });
    }
}

function validTaskId(id) {
    return /^[1-9]\d*$/.test(id);
}

function validTaskText(value, allowEmpty = false) {
    return typeof value === "string" && (allowEmpty || value.trim().length > 0);
}

function validDueDate(value) {
    if (value === null) {
        return true;
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function respondDatabaseError(res, context, error) {
    const unavailableCodes = new Set([
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
        "EHOSTUNREACH",
        "PROTOCOL_CONNECTION_LOST",
        "ER_ACCESS_DENIED_ERROR",
        "ER_BAD_DB_ERROR",
        "ER_NO_SUCH_TABLE",
        "ER_BAD_FIELD_ERROR"
    ]);
    const unavailable = unavailableCodes.has(error.code);

    console.error(`${context}：`, error.code || error.message);
    return res.status(unavailable ? 503 : 500).json({
        message: unavailable
            ? "数据库不可用或数据库结构尚未初始化"
            : context
    });
}

app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
        const [tasks] = await db.execute(
            `SELECT id, user_id, title, description, due_date, is_completed, created_at, updated_at
             FROM tasks
             WHERE user_id = ?
             ORDER BY created_at DESC, id DESC`,
            [req.userId]
        );
        res.json({ tasks });
    } catch (error) {
        respondDatabaseError(res, "查询任务失败", error);
    }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
    const { title, description = null, due_date: dueDate = null } = req.body || {};

    if (!validTaskText(title) || title.trim().length > 255) {
        return res.status(400).json({
            message: "title 必须是 1 到 255 个字符的非空字符串"
        });
    }
    if (description !== null && !validTaskText(description, true)) {
        return res.status(400).json({
            message: "description 必须是字符串或 null"
        });
    }
    if (!validDueDate(dueDate)) {
        return res.status(400).json({
            message: "due_date 必须是 YYYY-MM-DD 格式的有效日期或 null"
        });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO tasks (user_id, title, description, due_date)
             VALUES (?, ?, ?, ?)`,
            [req.userId, title.trim(), description, dueDate]
        );
        const [tasks] = await db.execute(
            `SELECT id, user_id, title, description, due_date, is_completed, created_at, updated_at
             FROM tasks
             WHERE id = ? AND user_id = ?`,
            [result.insertId, req.userId]
        );
        res.status(201).json({ task: tasks[0] });
    } catch (error) {
        respondDatabaseError(res, "新增任务失败", error);
    }
});

app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, description = null, due_date: dueDate = null } = req.body || {};

    if (!validTaskId(id)) {
        return res.status(400).json({ message: "任务 id 无效" });
    }
    if (!validTaskText(title) || title.trim().length > 255) {
        return res.status(400).json({
            message: "title 必须是 1 到 255 个字符的非空字符串"
        });
    }
    if (description !== null && !validTaskText(description, true)) {
        return res.status(400).json({
            message: "description 必须是字符串或 null"
        });
    }
    if (!validDueDate(dueDate)) {
        return res.status(400).json({
            message: "due_date 必须是 YYYY-MM-DD 格式的有效日期或 null"
        });
    }

    try {
        await db.execute(
            `UPDATE tasks
             SET title = ?, description = ?, due_date = ?
             WHERE id = ? AND user_id = ?`,
            [title.trim(), description, dueDate, id, req.userId]
        );

        const [tasks] = await db.execute(
            `SELECT id, user_id, title, description, due_date, is_completed, created_at, updated_at
             FROM tasks
             WHERE id = ? AND user_id = ?`,
            [id, req.userId]
        );
        if (tasks.length === 0) {
            return res.status(404).json({ message: "任务不存在" });
        }
        res.json({ task: tasks[0] });
    } catch (error) {
        respondDatabaseError(res, "修改任务失败", error);
    }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!validTaskId(id)) {
        return res.status(400).json({ message: "任务 id 无效" });
    }

    try {
        const [result] = await db.execute(
            "DELETE FROM tasks WHERE id = ? AND user_id = ?",
            [id, req.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "任务不存在" });
        }

        res.json({ message: "任务已删除" });
    } catch (error) {
        respondDatabaseError(res, "删除任务失败", error);
    }
});

app.patch("/api/tasks/:id/complete", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { is_completed: isCompleted } = req.body || {};

    if (!validTaskId(id)) {
        return res.status(400).json({ message: "任务 id 无效" });
    }
    if (typeof isCompleted !== "boolean") {
        return res.status(400).json({
            message: "is_completed 必须是布尔值"
        });
    }

    try {
        await db.execute(
            `UPDATE tasks
             SET is_completed = ?
             WHERE id = ? AND user_id = ?`,
            [isCompleted, id, req.userId]
        );

        const [tasks] = await db.execute(
            `SELECT id, user_id, title, description, due_date, is_completed, created_at, updated_at
             FROM tasks
             WHERE id = ? AND user_id = ?`,
            [id, req.userId]
        );
        if (tasks.length === 0) {
            return res.status(404).json({ message: "任务不存在" });
        }
        res.json({ task: tasks[0] });
    } catch (error) {
        respondDatabaseError(res, "修改任务状态失败", error);
    }
});

app.get("/api/statistics/tasks", requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                 COALESCE(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
                 0 AS doing,
                 COALESCE(SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END), 0) AS unfinished
             FROM tasks
             WHERE user_id = ?`,
            [req.userId]
        );

        res.json({
            completed: Number(rows[0].completed),
            doing: Number(rows[0].doing),
            unfinished: Number(rows[0].unfinished)
        });
    } catch (error) {
        respondDatabaseError(res, "查询任务统计失败", error);
    }
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});