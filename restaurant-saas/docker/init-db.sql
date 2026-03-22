CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
GRANT CONNECT ON DATABASE restaurant_saas TO app_user;
