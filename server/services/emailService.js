/**
 * Email Service
 * This service provides email functionality using Nodemailer
 */
const nodemailer = require('nodemailer');
const pool = require('../db');
require('dotenv').config();

// Create a transporter object - configure this with your email provider
let transporter;

// Initialize the email transporter
const initializeTransporter = () => {
  // Check if already initialized
  if (transporter) return;

  // For production, use your SMTP settings:
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'user@example.com',
      pass: process.env.EMAIL_PASSWORD || 'password'
    }
  });
};

/**
 * Send an email notification to a user
 * @param {number} userId - The ID of the user to send the email to
 * @param {object} notification - The notification object containing message and type
 * @returns {Promise<boolean>} - Returns true if email is sent successfully
 */
const sendEmail = async (userId, notification) => {
  try {
    // Initialize the transporter if not already done
    initializeTransporter();
    
    // Get user's email from database
    const userResult = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`Cannot send email: User ${userId} not found`);
      return false;
    }
    
    const user = userResult.rows[0];
    
    // Send the email
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Nova LMS" <noreply@novalms.com>',
      to: user.email,
      subject: `Nova LMS Notification: ${notification.type}`,
      text: notification.message,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Nova LMS Notification</h2>
        <p>Hello ${user.first_name} ${user.last_name},</p>
        <p>${notification.message}</p>
        <p>Regards,<br>The Nova LMS Team</p>
      </div>`
    };
    
    // If in development mode, log instead of sending
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_SEND_EMAILS) {
      console.log('[EMAIL SERVICE] Would send email:', mailOptions);
      return true;
    }
    
    // Actually send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/**
 * Send a password reset email to a user
 * @param {string} email - The email address to send the reset link to
 * @param {string} resetToken - The reset token to include in the link
 * @param {string} resetUrl - The base URL for the reset page
 * @returns {Promise<boolean>} - Returns true if email is sent successfully
 */
const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
  try {
    // Initialize the transporter if not already done
    initializeTransporter();
    
    // Get user from database
    const userResult = await pool.query(
      'SELECT user_id, first_name, last_name FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`Cannot send reset email: No user with email ${email}`);
      return false;
    }
    
    const user = userResult.rows[0];
    
    // Create the reset link
    const resetLink = `${resetUrl}?token=${resetToken}`;
    
    // Send the email
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Nova LMS" <noreply@novalms.com>',
      to: email,
      subject: 'Nova LMS Password Reset',
      text: `Hello ${user.first_name},\n\nYou requested a password reset for your Nova LMS account. Please click the following link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, please ignore this email.\n\nRegards,\nThe Nova LMS Team`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Nova LMS Password Reset</h2>
        <p>Hello ${user.first_name},</p>
        <p>You requested a password reset for your Nova LMS account. Please click the button below to reset your password:</p>
        <p style="text-align: center;">
          <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">Reset Password</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Regards,<br>The Nova LMS Team</p>
      </div>`
    };
    
    // If in development mode, log instead of sending
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_SEND_EMAILS) {
      console.log('[EMAIL SERVICE] Would send password reset email:', mailOptions);
      return true;
    }
    
    // Actually send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

/**
 * Send an email verification email to a user
 * @param {string} email - The email address to send the verification code to
 * @param {string} verificationCode - The verification code to include in the email
 * @param {string} firstName - The user's first name
 * @returns {Promise<boolean>} - Returns true if email is sent successfully
 */
const sendEmailVerification = async (email, verificationCode, firstName) => {
  try {
    // Initialize the transporter if not already done
    initializeTransporter();
    
    // Send the email
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Nova LMS" <noreply@novalms.com>',
      to: email,
      subject: 'Nova LMS Email Verification',
      text: `Hello ${firstName},\n\nThank you for registering with Nova LMS! Please use the following verification code to complete your registration:\n\n${verificationCode}\n\nThis code will expire in 5 minutes.\n\nIf you did not create an account with Nova LMS, please ignore this email.\n\nRegards,\nThe Nova LMS Team`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Nova LMS Email Verification</h2>
        <p>Hello ${firstName},</p>
        <p>Thank you for registering with Nova LMS! Please use the following verification code to complete your registration:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin: 0; color: #333; font-size: 24px; letter-spacing: 5px;">${verificationCode}</h3>
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not create an account with Nova LMS, please ignore this email.</p>
        <p>Regards,<br>The Nova LMS Team</p>
      </div>`
    };
    
    // If in development mode, log instead of sending
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_SEND_EMAILS) {
      console.log('[EMAIL SERVICE] Would send email verification:', mailOptions);
      return true;
    }
    
    // Actually send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email verification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email verification:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendEmailVerification
}; 