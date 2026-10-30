require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
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

// 专注、签到、统计和监督关系接口
app.use("/api/tasks", require("./taskRoutes")(db));
app.use("/api/focus", require("./focusRoutes")(db));
app.use("/api/checkin", require("./checkinRoutes")(db));
app.use("/api/stats", require("./statsRoutes")(db));
app.use("/api/supervision", require("./supervisionRoutes")(db));
app.use("/api/ranking", require("./rankingRoutes")(db));
app.use("/api/points", require("./pointsRoutes")(db));
app.use("/api/achievements", require("./achievementsRoutes")(db));

// ====================
// 修改用户昵称接口
// ====================
app.put("/api/users/nickname", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ message: "请先登录" });
    }

    let user;

    try {
        user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ message: "登录已过期，请重新登录" });
    }

    const nickname = typeof req.body.nickname === "string"
        ? req.body.nickname.trim()
        : "";

    if (!nickname || nickname.length > 50) {
        return res.status(400).json({
            message: "昵称不能为空，且不能超过50个字符"
        });
    }

    try {
        const [result] = await db.execute(
            "UPDATE users SET nickname = ? WHERE id = ?",
            [nickname, user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "用户不存在" });
        }

        return res.json({
            message: "昵称修改成功",
            nickname
        });
    } catch (error) {
        console.error("修改昵称失败：", error.message);
        return res.status(500).json({ message: "修改昵称失败" });
    }
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
// ====================
// 搜索用户（需要登录）
// ====================
app.get("/api/users/search", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "请先登录"
            });
        }

        const token = authHeader.split(" ")[1];

        let currentUser;

        try {
            currentUser = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                message: "登录状态已失效，请重新登录"
            });
        }

        const keyword = String(req.query.keyword || "").trim();

        if (!keyword) {
            return res.json({ users: [] });
        }

        const [users] = await db.execute(
            `SELECT id, username
             FROM users
             WHERE username LIKE ? AND id <> ?
             ORDER BY username
             LIMIT 20`,
            [`%${keyword}%`, currentUser.id]
        );

        res.json({ users });
    } catch (error) {
        console.error("搜索用户失败：", error.message);
        res.status(500).json({
            message: "搜索用户失败"
        });
    }
});

app.get("/api/task-route-test", (req, res) => {
    res.json({
        taskRouteLoaded: true,
        message: "当前服务器已加载最新诊断接口"
    });
});
app.get("/", (req, res) => {
    res.json({
        message: "大学生反拖延监督系统后端运行成功！"
    });
});

// 用户注册
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    if (typeof username !== "string" || typeof password !== "string" ||
        username.trim().length === 0 || password.length < 8) {
        return res.status(400).json({
            message: "用户名不能为空，密码至少需要 8 位"
        });
    }

    try {
        const cleanUsername = username.trim();
        const [existingUsers] = await db.execute(
            "SELECT id FROM users WHERE username = ?",
            [cleanUsername]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "用户名已经存在"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [cleanUsername, hashedPassword]
        );

        res.status(201).json({
            message: "注册成功",
            user: {
                id: result.insertId,
                username: cleanUsername
            }
        });
    } catch (error) {
        console.error("注册失败：", error.message);
        res.status(500).json({
            message: "注册失败"
        });
    }
});

// 用户登录
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password ||
        typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: "登录服务配置不完整"
        });
    }

    try {
        const [users] = await db.execute(
            "SELECT id, username, password FROM users WHERE username = ?",
            [username.trim()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "用户名或密码错误"
            });
        }

        const user = users[0];
        const storedPassword = String(user.password);
        const isHashed = storedPassword.startsWith("$2");

        const passwordMatches = isHashed
            ? await bcrypt.compare(password, storedPassword)
            : password === storedPassword;

        if (!passwordMatches) {
            return res.status(401).json({
                message: "用户名或密码错误"
            });
        }

        // 旧测试账号如果使用明文密码，登录成功后升级为哈希存储。
        if (!isHashed) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.execute(
                "UPDATE users SET password = ? WHERE id = ?",
                [hashedPassword, user.id]
            );
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "登录成功",
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error("登录失败：", error.message);
        res.status(500).json({
            message: "登录失败"
        });
    }
});

app.get("/api/route-test", (req, res) => {
    res.json({ message: "当前 server.js 路由已加载" });
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});