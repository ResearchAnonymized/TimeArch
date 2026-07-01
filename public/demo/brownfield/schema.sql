-- ShopFlow Legacy MySQL schema (export, schema-only)
-- Generated from prod replica. No migrations history available.

CREATE TABLE users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_md5  VARCHAR(32)  NOT NULL,           -- legacy hash, never rotated
  is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL
);

CREATE TABLE products (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price_cents   INT NOT NULL,
  stock         INT NOT NULL DEFAULT 0,
  category      VARCHAR(64),
  active        TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE carts (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  user_id   INT NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE cart_items (
  cart_id    INT NOT NULL,
  product_id INT NOT NULL,
  qty        INT NOT NULL,
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE orders (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  total_cents INT NOT NULL,
  status      VARCHAR(32) NOT NULL,        -- 'pending'|'paid'|'shipped'|'cancelled'
  payment_ref VARCHAR(128),
  created_at  DATETIME NOT NULL
);

CREATE TABLE order_items (
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  qty        INT NOT NULL,
  unit_price_cents INT NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE audit_log (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor_id  INT,
  action    VARCHAR(64),
  payload   TEXT,
  created_at DATETIME NOT NULL
);
