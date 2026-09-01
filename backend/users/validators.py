from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from django.core.validators import RegexValidator
import re


class PasswordStrengthValidator:
    """
    Custom password validator for strong password requirements
    """
    
    def __init__(self):
        self.min_length = 8
        self.require_uppercase = True
        self.require_lowercase = True
        self.require_numbers = True
        self.require_special_chars = True
    
    def validate(self, password, user=None):
        errors = []
        
        # Check minimum length
        if len(password) < self.min_length:
            errors.append(f"Password must be at least {self.min_length} characters long.")
        
        # Check for uppercase letters
        if self.require_uppercase and not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter.")
        
        # Check for lowercase letters
        if self.require_lowercase and not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter.")
        
        # Check for numbers
        if self.require_numbers and not re.search(r'\d', password):
            errors.append("Password must contain at least one number.")
        
        # Check for special characters
        if self.require_special_chars and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>).")
        
        # Check if password is too similar to user information
        if user:
            if user.first_name and user.first_name.lower() in password.lower():
                errors.append("Password cannot contain your first name.")
            
            if user.last_name and user.last_name.lower() in password.lower():
                errors.append("Password cannot contain your last name.")
            
            if user.email and user.email.split('@')[0].lower() in password.lower():
                errors.append("Password cannot contain your email address.")
        
        # Check for common patterns
        if re.search(r'(.)\1{2,}', password):
            errors.append("Password cannot contain more than 2 consecutive identical characters.")
        
        if errors:
            raise ValidationError(errors)
    
    def get_help_text(self):
        return (
            "Your password must contain at least 8 characters, including uppercase letters, "
            "lowercase letters, numbers, and special characters. It should not contain your "
            "personal information or common patterns."
        )


def validate_password_strength(password, user=None):
    """
    Validate password strength with custom requirements
    """
    validator = PasswordStrengthValidator()
    validator.validate(password, user)


def get_password_strength_score(password):
    """
    Calculate password strength score (0-100)
    """
    score = 0
    
    # Length score (0-30 points)
    if len(password) >= 8:
        score += 20
    if len(password) >= 12:
        score += 10
    
    # Character variety (0-40 points)
    if re.search(r'[a-z]', password):
        score += 10
    if re.search(r'[A-Z]', password):
        score += 10
    if re.search(r'\d', password):
        score += 10
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 10
    
    # Complexity (0-30 points)
    if len(set(password)) >= len(password) * 0.7:  # 70% unique characters
        score += 15
    if not re.search(r'(.)\1{2,}', password):  # No repeated characters
        score += 15
    
    return min(score, 100)


def get_password_strength_level(password):
    """
    Get password strength level based on score
    """
    score = get_password_strength_score(password)
    
    if score < 30:
        return "weak"
    elif score < 70:
        return "medium"
    else:
        return "strong"
