import User from "../models/userModel.js";
import { sendEmail } from "../middlewares/emailService.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const register = async (req, res) => {
  const { name, username, email, password } = req.body;

  try {
    // validasi email
    if (!email.includes("@")) {
      return res.status(400).json({ message: "Format email salah" });
    }

    // validasi password
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password minimal 8 karakter, mengandung huruf besar, angka, dan tanpa spasi",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    // generate token verifikasi
    const verifyToken = crypto.randomBytes(32).toString("hex");

    // expired 1 jam
    const verifyExpiredAt = new Date(Date.now() + 1000 * 60 * 5);

    const user = await User.create({
      name,
      username,
      email,
      password: hash,
      verifyToken,
      verifyExpiredAt,
    });

    const verifyLink = `http://localhost:3000/api/users/verify-email?token=${verifyToken}`;

    await sendEmail({
      to: email,
      subject: "Verifikasi Email",
      html: `
        <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;border:1px solid #ddd;background:#f5f5f5">
          <div style="text-align:center;padding:20px 0;border-bottom:3px solid #444;">
            <h1 style="margin:0;color:#2c3e50;">My App</h1>
          </div>

          <div style="background:#ffffff;padding:30px;">
            <h2 style="color:#333;">Verify Your Email Address</h2>
            <p>Thanks for creating your account on <b>My App</b>. Please click the link below to verify your email address.</p>

            <p>
            <a href="${verifyLink}" style="color:#1a73e8;">
              ${verifyLink}
            </a>
            </p>

            <p style="margin-top:20px;color:#555;">
              Link will be only valid for <b>5 minutes</b>.
            </p>
          </div>

          <div style="text-align:center;padding:15px;border-top:1px solid #ddd;background:#fafafa;font-size:12px;color:#777;">
            © My App All rights reserved.
          </div>
        </div>
      `,
    });

    res.status(201).json({
      status: true,
      message: "Register success, silakan cek email untuk verifikasi",
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Username atau Email sudah terdaftar",
      });
    }

    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findToken(token);

    if (!user) {
      return res.status(400).json({
        message: "Token tidak valid",
      });
    }

    if (user.verifyExpiredAt < new Date()) {
      return res.status(400).json({
        message: "Token expired",
      });
    }

    const dataToUpdate = {
      isVerified: true,
      verifyToken: null,
      verifyExpiredAt: null,
    };

    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: {
    //     isVerified: true,
    //     verifyToken: null,
    //     verifyExpiredAt: null,
    //   },
    // });

    await User.update(user.id, dataToUpdate);

    res.json({
      message: "Email berhasil diverifikasi",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Verification error",
    });
  }
};

export const login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const user = await User.findByUsernameOrEmail(identifier);
    if (!user)
      return res.status(401).json({ message: "Username atau Email salah" });

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Email belum diverifikasi",
      });
    }

    if (!user.password) {
      console.error(`User ${user.email} tidak memiliki password di database`);
      return res.status(500).json({ message: "Internal server error" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Password salah" });

    const token = jwt.sign(
      { id: user.id, identifier: user.identifier, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.status(200).json({
      status: true,
      message: "Login success",
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        access_token: token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserAll = async (_req, res) => {
  try {
    const userData = await User.findAll();
    res.status(200).json(userData);
  } catch (err) {
    console.error("Error getting users:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const userData = await User.findById(id);
    if (!userData) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.status(200).json(userData);
  } catch (err) {
    console.error("Error getting user:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, username, email, phone, alamat } = req.body;
  try {
    const dataToUpdate = {
      name,
      username,
      email,
      phone,
      alamat,
    };

    if (req.file) {
      dataToUpdate.image_url = `uploads/photos/${req.file.filename}`;
    }

    const updatedUser = await User.update(id, dataToUpdate);

    if (!updatedUser) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.status(200).json({
      message: "User berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.code && error.code.startsWith("P")) {
      return res.status(400).json({
        message: "Kesalahan database saat memperbarui user",
      });
    }
    res.status(500).json({
      message: "Gagal memperbarui user",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    const delteuser = await User.delete(id);

    if (!delteuser) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    if (user.image_url) {
      const filePath = path.join(__dirname, "..", user.image_url);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("File foto user berhasil dihapus:", filePath);
      } else {
        console.log("File foto user tidak ditemukan:", filePath);
      }
    }

    res.status(200).json({ message: "User berhasil dihapus" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
