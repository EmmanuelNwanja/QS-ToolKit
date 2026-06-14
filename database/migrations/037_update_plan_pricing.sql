-- ============================================================
--  037: Update subscription plan pricing and display labels
--  Basic=Starter=₦8,999, Pro=₦23,999, Enterprise=Elite=₦84,999
-- ============================================================

-- Update monthly prices
UPDATE subscription_plans SET price_monthly = 8999  WHERE name = 'basic';
UPDATE subscription_plans SET price_monthly = 23999 WHERE name = 'pro';
UPDATE subscription_plans SET price_monthly = 84999 WHERE name = 'enterprise';

-- Update annual prices (10% discount: monthly * 12 * 0.9)
UPDATE subscription_plans SET price_annual = 89990  WHERE name = 'basic';
UPDATE subscription_plans SET price_annual = 239990 WHERE name = 'pro';
UPDATE subscription_plans SET price_annual = 849990 WHERE name = 'enterprise';
