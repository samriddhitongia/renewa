const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendWelcomeEmail = async (to, name, role) => {

  const accountType =
    role === "producer" ? "Producer Account 🌞" : "Consumer Account ⚡";

  const dashboardLink =
    role === "producer"
      ? "http://localhost:3000/producer-dashboard"
      : "http://localhost:3000/marketplace";

  const badgeColor =
    role === "producer" ? "#16a34a" : "#2563eb";

  const mailOptions = {
    from: `"Renewa" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Welcome to Renewa 🌱",
    html: `
    
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:30px;">
      
      <div style="max-width:600px; margin:auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#22c55e,#15803d); padding:25px; text-align:center; color:white;">
          <h1 style="margin:0;">🌱 Renewa</h1>
          <p style="margin:5px 0 0;">Renewable Energy Marketplace</p>
        </div>

        <!-- Body -->
        <div style="padding:30px;">
          
          <h2 style="color:#111;">Hello ${name},</h2>

          <p style="font-size:16px; color:#444;">
            Your account has been successfully created.
          </p>

          <!-- Account Badge -->
          <div style="margin:20px 0;">
            <span style="
              background:${badgeColor};
              color:white;
              padding:10px 18px;
              border-radius:20px;
              font-size:14px;
              font-weight:bold;
            ">
              ${accountType}
            </span>
          </div>

          <!-- Account Details -->
          <div style="
            background:#f1f5f9;
            padding:15px;
            border-radius:8px;
            margin-top:15px;
          ">
            <p style="margin:5px 0;"><b>Email:</b> ${to}</p>
            <p style="margin:5px 0;"><b>Role:</b> ${role}</p>
          </div>

          <!-- Button -->
          <div style="text-align:center; margin:30px 0;">
            <a href="${dashboardLink}" 
               style="
                background:#22c55e;
                color:white;
                padding:14px 28px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
                display:inline-block;
               ">
               Go to Dashboard →
            </a>
          </div>

          <p style="color:#555;">
            Start exploring renewable energy trading and make an impact 🌍
          </p>

        </div>

        <!-- Footer -->
        <div style="background:#111827; color:#9ca3af; text-align:center; padding:20px; font-size:13px;">
          <p style="margin:5px;">© 2026 Renewa. All rights reserved.</p>
          <p style="margin:5px;">Clean Energy for Everyone ⚡</p>
        </div>

      </div>
    </div>
    
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendWelcomeEmail;