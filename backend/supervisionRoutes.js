
const express = require("express");

module.exports = function (db) {
    const router = express.Router();

    // 校验用户 ID
    function getUserId(value) {
        const id = Number(value);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }

    // 1. 发送监督邀请：POST /api/supervision/invitations
    router.post("/invitations", async (req, res) => {
        const userId = getUserId(req.body.userId);
        const targetUsername =
            typeof req.body.targetUsername === "string"
                ? req.body.targetUsername.trim()
                : "";

        if (!userId || !targetUsername) {
            return res.status(400).json({
                message: "请提供有效的用户ID和目标用户名"
            });
        }

        try {
            const [targets] = await db.execute(
                "SELECT id, username FROM users WHERE username = ?",
                [targetUsername]
            );

            if (targets.length === 0) {
                return res.status(404).json({
                    message: "未找到该用户"
                });
            }

            const targetId = Number(targets[0].id);

            if (targetId === userId) {
                return res.status(400).json({
                    message: "不能向自己发送监督邀请"
                });
            }

            // 不允许重复建立待处理或已接受的关系
            const [existing] = await db.execute(
                `SELECT id, status
                 FROM supervision_relationships
                 WHERE (
                    (requester_id = ? AND receiver_id = ?)
                    OR
                    (requester_id = ? AND receiver_id = ?)
                 )
                 AND status IN ('pending', 'accepted')
                 LIMIT 1`,
                [userId, targetId, targetId, userId]
            );

            if (existing.length > 0) {
                return res.status(409).json({
                    message: existing[0].status === "accepted"
                        ? "你们已经是监督伙伴"
                        : "你们之间已有待处理的监督邀请"
                });
            }

            await db.execute(
                `INSERT INTO supervision_relationships
                    (requester_id, receiver_id, status)
                 VALUES (?, ?, 'pending')`,
                [userId, targetId]
            );

            return res.status(201).json({
                message: "监督邀请已发送"
            });
        } catch (error) {
            console.error("发送监督邀请失败：", error.message);
            return res.status(500).json({
                message: "发送监督邀请失败"
            });
        }
    });

    // 2. 查询邀请：GET /api/supervision/invitations?userId=1
    router.get("/invitations", async (req, res) => {
        const userId = getUserId(req.query.userId);

        if (!userId) {
            return res.status(400).json({
                message: "请提供有效的用户ID"
            });
        }

        try {
            const [rows] = await db.execute(
                `SELECT
                    sr.id,
                    sr.requester_id AS requesterId,
                    sr.receiver_id AS receiverId,
                    sr.status,
                    sr.created_at AS createdAt,
                    u1.username AS requesterUsername,
                    u2.username AS receiverUsername
                 FROM supervision_relationships sr
                 JOIN users u1 ON u1.id = sr.requester_id
                 JOIN users u2 ON u2.id = sr.receiver_id
                 WHERE sr.requester_id = ? OR sr.receiver_id = ?
                 ORDER BY sr.created_at DESC`,
                [userId, userId]
            );

            return res.json({
                message: "邀请查询成功",
                data: rows
            });
        } catch (error) {
            console.error("查询监督邀请失败：", error.message);
            return res.status(500).json({
                message: "查询监督邀请失败"
            });
        }
    });

    // 3. 接受或拒绝邀请：
    // PATCH /api/supervision/invitations/:id
    // 请求体：{ "userId": 2, "action": "accept" }
    router.patch("/invitations/:id", async (req, res) => {
        const userId = getUserId(req.body.userId);
        const invitationId = getUserId(req.params.id);
        const action = req.body.action;

        if (
            !userId ||
            !invitationId ||
            !["accept", "reject"].includes(action)
        ) {
            return res.status(400).json({
                message: "请求参数无效"
            });
        }

        try {
            const [rows] = await db.execute(
                `SELECT id
                 FROM supervision_relationships
                 WHERE id = ?
                   AND receiver_id = ?
                   AND status = 'pending'`,
                [invitationId, userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "邀请不存在、已处理或你无权处理"
                });
            }

            const newStatus =
                action === "accept" ? "accepted" : "rejected";

            await db.execute(
                `UPDATE supervision_relationships
                 SET status = ?
                 WHERE id = ?
                   AND receiver_id = ?
                   AND status = 'pending'`,
                [newStatus, invitationId, userId]
            );

            return res.json({
                message: action === "accept"
                    ? "已接受监督邀请"
                    : "已拒绝监督邀请",
                status: newStatus
            });
        } catch (error) {
            console.error("处理监督邀请失败：", error.message);
            return res.status(500).json({
                message: "处理监督邀请失败"
            });
        }
    });

    // 4. 查询监督伙伴：
    // GET /api/supervision/partners?userId=1
    router.get("/partners", async (req, res) => {
        const userId = getUserId(req.query.userId);

        if (!userId) {
            return res.status(400).json({
                message: "请提供有效的用户ID"
            });
        }

        try {
            const [rows] = await db.execute(
                `SELECT
                    u.id AS userId,
                    u.username,
                    sr.id AS relationshipId,
                    sr.created_at AS connectedAt
                 FROM supervision_relationships sr
                 JOIN users u
                   ON u.id = CASE
                       WHEN sr.requester_id = ? THEN sr.receiver_id
                       ELSE sr.requester_id
                   END
                 WHERE (
                    sr.requester_id = ? OR sr.receiver_id = ?
                 )
                   AND sr.status = 'accepted'
                 ORDER BY sr.updated_at DESC`,
                [userId, userId, userId]
            );

            return res.json({
                message: "监督伙伴查询成功",
                data: rows
            });
        } catch (error) {
            console.error("查询监督伙伴失败：", error.message);
            return res.status(500).json({
                message: "查询监督伙伴失败"
            });
        }
    });

    // 5. 查看已接受监督伙伴的进度：
    // GET /api/supervision/partners/:partnerId/progress?userId=1
    router.get("/partners/:partnerId/progress", async (req, res) => {
        const userId = getUserId(req.query.userId);
        const partnerId = getUserId(req.params.partnerId);

        if (!userId || !partnerId || userId === partnerId) {
            return res.status(400).json({
                message: "用户参数无效"
            });
        }

        try {
            const [relationships] = await db.execute(
                `SELECT id
                 FROM supervision_relationships
                 WHERE (
                    (requester_id = ? AND receiver_id = ?)
                    OR
                    (requester_id = ? AND receiver_id = ?)
                 )
                   AND status = 'accepted'
                 LIMIT 1`,
                [userId, partnerId, partnerId, userId]
            );

            if (relationships.length === 0) {
                return res.status(403).json({
                    message: "只有已建立监督关系的伙伴才能查看进度"
                });
            }

            const [focusRows] = await db.execute(
                `SELECT
                    COALESCE(SUM(
                        CASE
                            WHEN DATE(start_time) = CURDATE()
                            THEN duration ELSE 0
                        END
                    ), 0) AS todayMinutes,
                    COUNT(
                        CASE
                            WHEN DATE(start_time) = CURDATE()
                            THEN 1
                        END
                    ) AS todaySessions,
                    COALESCE(SUM(duration), 0) AS totalMinutes
                 FROM focus_records
                 WHERE user_id = ?`,
                [partnerId]
            );

            const [checkinRows] = await db.execute(
                `SELECT
                    COUNT(*) AS totalCheckins,
                    COALESCE(MAX(
                        checkin_date = CURDATE()
                    ), 0) AS checkedInToday
                 FROM daily_checkins
                 WHERE user_id = ?`,
                [partnerId]
            );

            return res.json({
                message: "监督伙伴进度查询成功",
                data: {
                    userId: partnerId,
                    todayMinutes: Number(focusRows[0].todayMinutes),
                    todaySessions: Number(focusRows[0].todaySessions),
                    totalMinutes: Number(focusRows[0].totalMinutes),
                    totalCheckins: Number(checkinRows[0].totalCheckins),
                    checkedInToday:
                        Number(checkinRows[0].checkedInToday) === 1
                }
            });
        } catch (error) {
            console.error("查询伙伴进度失败：", error.message);
            return res.status(500).json({
                message: "查询伙伴进度失败"
            });
        }
    });

    return router;
};
