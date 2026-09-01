# validators.py - Student Form Validation

import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class StudentValidator:
    """Student form validation utilities"""
    
    @staticmethod
    def validate_phone_number(value):
        """Validate Pakistan phone number format"""
        if not value:
            return
        
        # Remove all non-digit characters
        clean_phone = re.sub(r'\D', '', str(value))
        
        # Check if exactly 11 digits
        if len(clean_phone) != 11:
            raise ValidationError(_('Phone number must be exactly 11 digits'))
        
        # Check if starts with 03 (Pakistan mobile format)
        if not clean_phone.startswith('03'):
            raise ValidationError(_('Phone number must start with 03'))
        
        return clean_phone
    
    @staticmethod
    def validate_cnic(value):
        """Validate Pakistan CNIC format"""
        if not value:
            return
        
        # Remove all non-digit characters
        clean_cnic = re.sub(r'\D', '', str(value))
        
        # Check if exactly 13 digits
        if len(clean_cnic) != 13:
            raise ValidationError(_('CNIC must be exactly 13 digits'))
        
        return clean_cnic
    
    @staticmethod
    def validate_name(value):
        """Validate name format"""
        if not value:
            raise ValidationError(_('Name is required'))
        
        if len(value.strip()) < 2:
            raise ValidationError(_('Name must be at least 2 characters'))
        
        if len(value.strip()) > 200:
            raise ValidationError(_('Name must be less than 200 characters'))
        
        # Check if contains only letters, spaces, and common name characters
        import re
        # Use a simpler approach - check for invalid characters instead
        invalid_chars = re.findall(r'[^a-zA-Z\s\.\-\']', value.strip())
        if invalid_chars:
            raise ValidationError(_('Name can only contain letters, spaces, dots, hyphens, and apostrophes'))
        
        return value.strip()
    
    @staticmethod
    def validate_positive_number(value, field_name="Value"):
        """Validate positive number"""
        if value is None:
            return
        
        try:
            num = float(value)
            if num < 0:
                raise ValidationError(_(f'{field_name} must be a positive number'))
        except (ValueError, TypeError):
            raise ValidationError(_(f'{field_name} must be a valid number'))
        
        return num
    
    @staticmethod
    def validate_positive_integer(value, field_name="Value"):
        """Validate positive integer"""
        if value is None:
            return
        
        try:
            num = int(value)
            if num < 0:
                raise ValidationError(_(f'{field_name} must be a positive integer'))
        except (ValueError, TypeError):
            raise ValidationError(_(f'{field_name} must be a valid integer'))
        
        return num
    
    @staticmethod
    def validate_year(value, field_name="Year"):
        """Validate year range"""
        if not value:
            raise ValidationError(_(f'{field_name} is required'))
        
        try:
            year = int(value)
            if year < 2000 or year > 2030:
                raise ValidationError(_(f'{field_name} must be between 2000 and 2030'))
        except (ValueError, TypeError):
            raise ValidationError(_(f'{field_name} must be a valid year'))
        
        return year
    
    @staticmethod
    def validate_address(value):
        """Validate address format"""
        if not value:
            raise ValidationError(_('Address is required'))
        
        if len(value.strip()) < 5:
            raise ValidationError(_('Address must be at least 5 characters'))
        
        if len(value.strip()) > 500:
            raise ValidationError(_('Address must be less than 500 characters'))
        
        return value.strip()
    
    @staticmethod
    def validate_date_of_birth(value):
        """Validate date of birth"""
        if not value:
            raise ValidationError(_('Date of birth is required'))
        
        from datetime import date
        
        if isinstance(value, str):
            try:
                value = date.fromisoformat(value)
            except ValueError:
                raise ValidationError(_('Please enter a valid date'))
        
        today = date.today()
        
        if value > today:
            raise ValidationError(_('Date of birth cannot be in the future'))
        
        # Calculate age
        age = today.year - value.year
        if today.month < value.month or (today.month == value.month and today.day < value.day):
            age -= 1
        
        if age < 3:
            raise ValidationError(_('Student must be at least 3 years old'))
        
        if age > 25:
            raise ValidationError(_('Student age cannot exceed 25 years'))
        
        return value
