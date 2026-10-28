require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

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


/* ====================
   JWT 身份验证中间件
==================== */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "请先登录"
        });
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        if (!payload.sub) {
            return res.status(401).json({
                message: "登录令牌无效"
            });
        }

        req.userId = Number(payload.sub);

        if (!Number.isSafeInteger(req.userId) || req.userId <= 0) {
            return res.status(401).json({
                message: "登录令牌无效"
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            message: "登录已过期或令牌无效，请重新登录"
        });
    }
}


// ====================
// 首页
// ====================
app.get("/", (req, res) => {
    res.json({
        message: "大学生反拖延监督系统后端运行成功！"
    });
});


/* ====================
   用户注册
   POST /api/register
==================== */
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    const cleanUsername = username.trim();

    if (cleanUsername.length > 50) {
        return res.status(400).json({
            message: "用户名不能超过50个字符"
        });
    }

    try {
        const [existingUsers] = await db.execute(
            "SELECT id FROM users WHERE username = ?",
            [cleanUsername]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "用户名已存在"
            });
        }

        // 暂时兼容项目当前使用明文密码的数据库
        const [result] = await db.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [cleanUsername, password]
        );

        return res.status(201).json({
            message: "注册成功",
            user: {
                id: result.insertId,
                username: cleanUsername
            }
        });
    } catch (error) {
        console.error("注册失败：", error.message);

        return res.status(500).json({
            message: "注册失败"
        });
    }
});


/* ====================
   用户登录
   POST /api/login
==================== */
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    try {
        const [users] = await db.execute(
            "SELECT id, username, password FROM users WHERE username = ?",
            [username.trim()]
        );

        if (
            users.length === 0 ||
            users[0].password !== password
        ) {
            return res.status(401).json({
                message: "用户名或密码错误"
            });
        }

        if (
            !process.env.JWT_SECRET ||
            Buffer.byteLength(process.env.JWT_SECRET, "utf8") < 32
        ) {
            console.error("JWT_SECRET 未配置或长度不足");

            return res.status(500).json({
                message: "服务器登录配置错误"
            });
        }

        const user = users[0];

        const token = jwt.sign(
            { sub: String(user.id) },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: "1h"
            }
        );

        return res.json({
            message: "登录成功",
            user: {
                id: user.id,
                username: user.username
            },
            token,
            tokenType: "Bearer",
            expiresIn: 3600
        });
    } catch (error) {
        console.error("登录失败：", error.message);

        return res.status(500).json({
            message: "登录失败"
        });
    }
});


/* ====================
   获取当前用户的任务列表
   GET /api/tasks
==================== */
app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
        const [tasks] = await db.execute(
            `SELECT
                id,
                user_id,
                title,
                description,
                deadline,
                status,
                created_at
             FROM tasks
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.userId]
        );

        res.json({
            tasks: tasks
        });
    } catch (error) {
        console.error("获取任务列表失败：", error.message);

        res.status(500).json({
            message: "获取任务列表失败"
        });
    }
});


/* ====================
   创建新任务
   POST /api/tasks
==================== */
app.post("/api/tasks", requireAuth, async (req, res) => {
    const { title, description, deadline } = req.body;

    // 检查任务名称
    if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
            message: "请输入任务名称"
        });
    }

    if (title.trim().length > 100) {
        return res.status(400).json({
            message: "任务名称不能超过100个字符"
        });
    }

    // 检查截止时间格式
    let formattedDeadline = null;

    if (deadline) {
        const parsedDeadline = new Date(deadline);

        if (Number.isNaN(parsedDeadline.getTime())) {
            return res.status(400).json({
                message: "截止时间格式不正确"
            });
        }

        formattedDeadline = parsedDeadline;
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO tasks
                (user_id, title, description, deadline, status)
             VALUES (?, ?, ?, ?, ?)`,
            [
                req.userId,
                title.trim(),
                typeof description === "string"
                    ? description.trim() || null
                    : null,
                formattedDeadline,
                "pending"
            ]
        );

        // 查询刚刚保存的任务
        const [rows] = await db.execute(
            `SELECT
                id,
                user_id,
                title,
                description,
                deadline,
                status,
                created_at
             FROM tasks
             WHERE id = ? AND user_id = ?`,
            [result.insertId, req.userId]
        );

        return res.status(201).json({
            message: "任务添加成功",
            task: rows[0]
        });
    } catch (error) {
        console.error("添加任务失败：", error.message);

        return res.status(500).json({
            message: "添加任务失败"
        });
    }
});





app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    const { title, description, deadline } = req.body;
    const taskId = Number(req.params.id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({
            message: "任务ID不正确"
        });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
            message: "请输入任务名称"
        });
    }

    if (title.trim().length > 100) {
        return res.status(400).json({
            message: "任务名称不能超过100个字符"
        });
    }

    let formattedDeadline = null;

    if (deadline) {
        const parsedDeadline = new Date(deadline);

        if (Number.isNaN(parsedDeadline.getTime())) {
            return res.status(400).json({
                message: "截止时间格式不正确"
            });
        }

        formattedDeadline = parsedDeadline;
    }

    try {
        const [result] = await db.execute(
            `UPDATE tasks
             SET title = ?, description = ?, deadline = ?
             WHERE id = ? AND user_id = ?`,
            [
                title.trim(),
                typeof description === "string"
                    ? description.trim() || null
                    : null,
                formattedDeadline,
                taskId,
                req.userId
            ]
        );

        
if (result.affectedRows === 0) {
    const [existingTasks] = await db.execute(
        `SELECT id FROM tasks WHERE id = ? AND user_id = ?`,
        [taskId, req.userId]
    );

    if (existingTasks.length === 0) {
        return res.status(404).json({
            message: "任务不存在或无权修改"
        });
    }
}


        const [rows] = await db.execute(
            `SELECT id, user_id, title, description, deadline, status, created_at
             FROM tasks
             WHERE id = ? AND user_id = ?`,
            [taskId, req.userId]
        );

        return res.json({
            message: "任务修改成功",
            task: rows[0]
        });
    } catch (error) {
        console.error("修改任务失败：", error.message);

        return res.status(500).json({
            message: "修改任务失败"
        });
    }
});


/* ====================
   GET /api/checkins/today
   查询当前用户今天的打卡状态
==================== */
app.get("/api/checkins/today", requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, user_id, checkin_date, created_at
             FROM checkin_records
             WHERE user_id = ? AND checkin_date = CURDATE()
             LIMIT 1`,
            [req.userId]
        );

        return res.json({
            checkedIn: rows.length > 0,
            checkin: rows.length > 0 ? rows[0] : null
        });
    } catch (error) {
        console.error("查询今日打卡失败：", error.message);

        return res.status(500).json({
            message: "查询今日打卡失败"
        });
    }
});


/* ====================
   POST /api/checkins
   保存当前用户今天的打卡记录
==================== */
app.post("/api/checkins", requireAuth, async (req, res) => {
    try {
        // 先检查今天是否已经打卡
        const [existing] = await db.execute(
            `SELECT id, user_id, checkin_date, created_at
             FROM checkin_records
             WHERE user_id = ? AND checkin_date = CURDATE()
             LIMIT 1`,
            [req.userId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "今天已经打过卡了",
                checkedIn: true,
                checkin: existing[0]
            });
        }

        // 保存打卡记录，用户 ID 来自登录令牌
        const [result] = await db.execute(
            `INSERT INTO checkin_records (user_id, checkin_date)
             VALUES (?, CURDATE())`,
            [req.userId]
        );

        // 查询刚刚保存的记录
        const [rows] = await db.execute(
            `SELECT id, user_id, checkin_date, created_at
             FROM checkin_records
             WHERE id = ? AND user_id = ?`,
            [result.insertId, req.userId]
        );

        return res.status(201).json({
            message: "打卡成功",
            checkedIn: true,
            checkin: rows[0]
        });
    } catch (error) {
        console.error("保存打卡记录失败：", error.message);

        return res.status(500).json({
            message: "保存打卡记录失败"
        });
    }
});


/* ====================
   GET /api/checkins/history
   查询当前用户的打卡历史和统计
==================== */
app.get("/api/checkins/history", requireAuth, async (req, res) => {
    try {
        // 查询累计打卡次数及全部打卡日期
        const [rows] = await db.execute(
            `SELECT checkin_date
             FROM checkin_records
             WHERE user_id = ?
             ORDER BY checkin_date DESC`,
            [req.userId]
        );

        const dates = rows.map(row => {
            const value = row.checkin_date;

            // 避免日期被 JavaScript 转换时产生时区偏差
            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, "0");
                const day = String(value.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
            }

            return String(value).slice(0, 10);
        });

        // 统计当前连续打卡天数
        const dateSet = new Set(dates);
        const todayRows = await db.execute(
            `SELECT CURDATE() AS today`,
            []
        );

        const todayValue = todayRows[0][0].today;
        const today = todayValue instanceof Date
            ? `${todayValue.getFullYear()}-${String(todayValue.getMonth() + 1).padStart(2, "0")}-${String(todayValue.getDate()).padStart(2, "0")}`
            : String(todayValue).slice(0, 10);

        const yesterdayDate = new Date(`${today}T00:00:00`);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = [
            yesterdayDate.getFullYear(),
            String(yesterdayDate.getMonth() + 1).padStart(2, "0"),
            String(yesterdayDate.getDate()).padStart(2, "0")
        ].join("-");

        // 如果今天还没打卡，从昨天开始计算当前连续天数
        let cursor = dateSet.has(today) ? today : yesterday;
        let currentStreak = 0;

        while (dateSet.has(cursor)) {
            currentStreak++;

            const previousDate = new Date(`${cursor}T00:00:00`);
            previousDate.setDate(previousDate.getDate() - 1);

            cursor = [
                previousDate.getFullYear(),
                String(previousDate.getMonth() + 1).padStart(2, "0"),
                String(previousDate.getDate()).padStart(2, "0")
            ].join("-");
        }

        return res.json({
            totalCheckins: dates.length,
            currentStreak,
            dates
        });
    } catch (error) {
        console.error("查询打卡历史失败：", error.message);

        return res.status(500).json({
            message: "查询打卡历史失败"
        });
    }
});


/* ====================
   GET /api/users/search
   按用户名搜索其他用户
==================== */
app.get("/api/users/search", requireAuth, async (req, res) => {
    try {
        const keyword = String(req.query.keyword || "").trim();

        if (!keyword) {
            return res.status(400).json({
                message: "请输入要搜索的用户名"
            });
        }

        if (keyword.length > 50) {
            return res.status(400).json({
                message: "搜索关键词不能超过50个字符"
            });
        }

        const [rows] = await db.execute(
            `SELECT id, username
             FROM users
             WHERE username LIKE ?
               AND id <> ?
             ORDER BY username
             LIMIT 20`,
            [`%${keyword}%`, req.userId]
        );

        return res.json({
            users: rows
        });
    } catch (error) {
        console.error("搜索用户失败：", error.message);

        return res.status(500).json({
            message: "搜索用户失败，请稍后重试"
        });
    }
});


/* ====================
   POST /api/friendships
   发送好友监督邀请
==================== */
app.post("/api/friendships", requireAuth, async (req, res) => {
    try {
        const receiverId = Number(req.body.receiverId);
        const requesterId = req.userId;

        if (!Number.isSafeInteger(receiverId) || receiverId <= 0) {
            return res.status(400).json({
                message: "请选择有效的邀请对象"
            });
        }

        if (receiverId === requesterId) {
            return res.status(400).json({
                message: "不能向自己发送监督邀请"
            });
        }

        // 确认邀请对象存在
        const [users] = await db.execute(
            "SELECT id FROM users WHERE id = ? LIMIT 1",
            [receiverId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "该用户不存在"
            });
        }

        // 检查双方是否已有关系，避免重复邀请
        const [existing] = await db.execute(
            `SELECT id, requester_id, receiver_id, status
             FROM friendships
             WHERE (requester_id = ? AND receiver_id = ?)
                OR (requester_id = ? AND receiver_id = ?)
             LIMIT 1`,
            [requesterId, receiverId, receiverId, requesterId]
        );

        if (existing.length > 0) {
            const relation = existing[0];

            if (relation.status === "accepted") {
                return res.status(409).json({
                    message: "你们已经建立监督关系"
                });
            }

            if (relation.status === "pending") {
                return res.status(409).json({
                    message: "你们之间已有待处理的监督邀请"
                });
            }

            return res.status(409).json({
                message: "你们之间已有被拒绝的邀请记录，暂时无法重复邀请"
            });
        }

        // 保存邀请
        const [result] = await db.execute(
            `INSERT INTO friendships
                (requester_id, receiver_id, status)
             VALUES (?, ?, 'pending')`,
            [requesterId, receiverId]
        );

        return res.status(201).json({
            message: "监督邀请已发送",
            friendship: {
                id: result.insertId,
                requesterId,
                receiverId,
                status: "pending"
            }
        });
    } catch (error) {
        console.error("发送监督邀请失败：", error.message);

        return res.status(500).json({
            message: "发送监督邀请失败，请稍后重试"
        });
    }
});


/* ====================
   GET /api/friendships
   查询收到的邀请和已建立的监督关系
==================== */
app.get("/api/friendships", requireAuth, async (req, res) => {
    try {
        const userId = req.userId;

        // 查询当前用户收到的待处理邀请
        const [receivedInvitations] = await db.execute(
            `SELECT
                f.id,
                f.requester_id AS requesterId,
                u.username AS requesterUsername,
                f.status,
                f.created_at AS createdAt
             FROM friendships f
             JOIN users u ON u.id = f.requester_id
             WHERE f.receiver_id = ?
               AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [userId]
        );

        // 查询已经接受邀请的监督好友
        const [friends] = await db.execute(
            `SELECT
                f.id AS friendshipId,
                f.requester_id AS requesterId,
                f.receiver_id AS receiverId,
                CASE
                    WHEN f.requester_id = ? THEN f.receiver_id
                    ELSE f.requester_id
                END AS friendId,
                u.username AS friendUsername,
                f.created_at AS createdAt
             FROM friendships f
             JOIN users u
               ON u.id = CASE
                   WHEN f.requester_id = ? THEN f.receiver_id
                   ELSE f.requester_id
               END
             WHERE (f.requester_id = ? OR f.receiver_id = ?)
               AND f.status = 'accepted'
             ORDER BY f.created_at DESC`,
            [userId, userId, userId, userId]
        );

        return res.json({
            receivedInvitations,
            friends
        });
    } catch (error) {
        console.error("查询监督关系失败：", error.message);

        return res.status(500).json({
            message: "查询监督关系失败，请稍后重试"
        });
    }
});


/* ====================
   POST /api/friendships/:id/accept
   接受好友监督邀请
==================== */
app.post("/api/friendships/:id/accept", requireAuth, async (req, res) => {
    try {
        const friendshipId = Number(req.params.id);
        const userId = req.userId;

        if (!Number.isSafeInteger(friendshipId) || friendshipId <= 0) {
            return res.status(400).json({
                message: "无效的邀请 ID"
            });
        }

        // 只有邀请接收方才能接受自己的待处理邀请
        const [result] = await db.execute(
            `UPDATE friendships
             SET status = 'accepted',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND receiver_id = ?
               AND status = 'pending'`,
            [friendshipId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "邀请不存在、已处理，或你无权接受此邀请"
            });
        }

        return res.json({
            message: "已接受监督邀请，双方已成为监督好友",
            friendshipId
        });
    } catch (error) {
        console.error("接受监督邀请失败：", error.message);

        return res.status(500).json({
            message: "接受邀请失败，请稍后重试"
        });
    }
});


const PORT = 3000;

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});