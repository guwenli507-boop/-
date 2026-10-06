require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

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
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "用户名和密码不能为空"
        });
    }

    try {
        const [existingUsers] = await db.execute(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                message: "用户名已经存在"
            });
        }

        await db.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, password]
        );

        res.json({
            message: "注册成功"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "注册失败"
        });
    }
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});