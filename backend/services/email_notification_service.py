from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

class EmailNotificationService:
    DEFAULT_PASSWORD = '12345'
    
    @staticmethod
    def send_credentials_email(user, employee_code, entity_type):
        """Send login credentials to newly created user"""
        subject = f'Welcome to School Management System - Your Login Credentials'
        
        role_display = entity_type.capitalize()
        
        message = f"""
Dear {user.first_name} {user.last_name},

Welcome to the School Management System!

Your account has been created with the following credentials:

Employee Code: {employee_code}
Password: {EmailNotificationService.DEFAULT_PASSWORD}

Please login at: {settings.FRONTEND_URL}/Universal_Login

For security, please change your password after first login.

Best regards,
School Administration
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            return True, "Email sent successfully"
        except Exception as e:
            return False, f"Failed to send email: {str(e)}"
    
    @staticmethod
    def send_password_change_otp_email(user, otp_code):
        """Send OTP code for password change verification"""
        subject = 'Password Change Verification - School Management System'
        
        # Create HTML email template with project colors
        html_message = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Change Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #6096ba, #a3cef1); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">
                        Password Change Verification
                    </h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #274c77; margin: 0 0 20px 0; font-size: 20px;">
                        Hello {user.first_name or user.username},
                    </h2>
                    
                    <p style="color: #333; line-height: 1.6; margin: 0 0 20px 0;">
                        You have requested to change your password. Please use the following verification code to proceed:
                    </p>
                    
                    <!-- OTP Code Box -->
                    <div style="background-color: #f8f9fa; border: 2px solid #6096ba; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                        <p style="color: #274c77; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">
                            Your Verification Code:
                        </p>
                        <div style="font-size: 32px; font-weight: bold; color: #6096ba; letter-spacing: 5px; font-family: monospace;">
                            {otp_code}
                        </div>
                    </div>
                    
                    <!-- Warning -->
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
                        <p style="color: #856404; margin: 0; font-size: 14px;">
                            <strong>⚠️ Important:</strong> This code will expire in 2 minutes for security reasons. 
                            If you didn't request this password change, please ignore this email.
                        </p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6; margin: 20px 0 0 0; font-size: 14px;">
                        If you have any questions or concerns, please contact the school administration.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #274c77; padding: 20px; text-align: center;">
                    <p style="color: white; margin: 0; font-size: 12px;">
                        © 2025 School Management System. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        message = f"""
Hello {user.first_name or user.username},

You have requested to change your password. Please use the following verification code to proceed:

Your Verification Code: {otp_code}

⚠️ Important: This code will expire in 2 minutes for security reasons.
If you didn't request this password change, please ignore this email.

If you have any questions or concerns, please contact the school administration.

Best regards,
School Administration
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
                html_message=html_message,
            )
            return True, "OTP email sent successfully"
        except Exception as e:
            return False, f"Failed to send OTP email: {str(e)}"
