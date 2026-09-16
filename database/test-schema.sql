-- Test script to validate D1 schema
-- Run this to verify your database is set up correctly

-- Test basic queries
SELECT 'Testing organizations table' as test;
SELECT COUNT(*) as count FROM organizations;

SELECT 'Testing properties table' as test;
SELECT COUNT(*) as count FROM properties;

SELECT 'Testing residents table' as test;
SELECT COUNT(*) as count FROM residents;

SELECT 'Testing users table' as test;
SELECT COUNT(*) as count FROM users;

-- Test joins
SELECT 'Testing property-resident relationship' as test;
SELECT p.name as property_name, COUNT(r.id) as resident_count 
FROM properties p 
LEFT JOIN residents r ON p.id = r.property_id 
GROUP BY p.id, p.name;

-- Test permissions
SELECT 'Testing role permissions' as test;
SELECT role, permissions FROM role_permissions LIMIT 3;

-- Test system settings
SELECT 'Testing system settings' as test;
SELECT * FROM system_settings;