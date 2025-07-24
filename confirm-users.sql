-- Confirm all existing users (for development only)
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    phone_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;