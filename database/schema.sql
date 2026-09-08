CREATE DATABASE IF NOT EXISTS assetflowdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE assetflowdb;

CREATE TABLE IF NOT EXISTS organizations (
  OrganizationId INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(150) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  RoleKey VARCHAR(40) PRIMARY KEY,
  Name VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  PermissionKey VARCHAR(40) PRIMARY KEY,
  Name VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  RoleKey VARCHAR(40) NOT NULL,
  PermissionKey VARCHAR(40) NOT NULL,
  PRIMARY KEY (RoleKey, PermissionKey),
  CONSTRAINT fk_rp_role FOREIGN KEY (RoleKey) REFERENCES roles (RoleKey),
  CONSTRAINT fk_rp_perm FOREIGN KEY (PermissionKey) REFERENCES permissions (PermissionKey)
);

CREATE TABLE IF NOT EXISTS users (
  UserId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NULL,
  Username VARCHAR(80) NOT NULL UNIQUE,
  Password VARCHAR(255) NOT NULL,
  FullName VARCHAR(150) NOT NULL,
  RoleKey VARCHAR(40) NOT NULL DEFAULT 'employee',
  Status VARCHAR(20) NOT NULL DEFAULT 'active',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId),
  CONSTRAINT fk_users_role FOREIGN KEY (RoleKey) REFERENCES roles (RoleKey)
);

CREATE TABLE IF NOT EXISTS departments (
  DepartmentId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dept_org_name (OrganizationId, Name),
  CONSTRAINT fk_dept_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS locations (
  LocationId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_loc_org_name (OrganizationId, Name),
  CONSTRAINT fk_loc_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS projects (
  ProjectId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'active',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proj_org_name (OrganizationId, Name),
  CONSTRAINT fk_proj_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS asset_categories (
  CategoryId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cat_org_name (OrganizationId, Name),
  CONSTRAINT fk_cat_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS suppliers (
  SupplierId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supplier_org_name (OrganizationId, Name),
  CONSTRAINT fk_supplier_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS manufacturers (
  ManufacturerId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mfr_org_name (OrganizationId, Name),
  CONSTRAINT fk_mfr_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS countries (
  CountryId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_country_org_name (OrganizationId, Name),
  CONSTRAINT fk_country_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  MaintenanceScheduleId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  Name VARCHAR(120) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_maint_org_name (OrganizationId, Name),
  CONSTRAINT fk_maint_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);

CREATE TABLE IF NOT EXISTS assets (
  AssetId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  AssetTag VARCHAR(40) NOT NULL,
  Name VARCHAR(180) NOT NULL,
  Description TEXT NULL,
  CategoryId INT NULL,
  Brand VARCHAR(120) NULL,
  Model VARCHAR(120) NULL,
  SerialNumber VARCHAR(120) NULL,
  PurchaseDate DATE NULL,
  PurchaseCost DECIMAL(12, 2) NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'Available',
  LocationId INT NULL,
  DepartmentId INT NULL,
  ProjectId INT NULL,
  SupplierId INT NULL,
  ManufacturerId INT NULL,
  CountryOfOriginId INT NULL,
  ReceiveDate DATE NULL,
  LastWarrantyDate DATE NULL,
  MaintenanceScheduleId INT NULL,
  Remarks TEXT NULL,
  CurrentAssignmentId INT NULL,
  CreatedBy INT NULL,
  UpdatedBy INT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_asset_tag (OrganizationId, AssetTag),
  KEY idx_assets_status (OrganizationId, Status),
  KEY idx_assets_search (OrganizationId, Name, SerialNumber),
  CONSTRAINT fk_assets_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId),
  CONSTRAINT fk_assets_cat FOREIGN KEY (CategoryId) REFERENCES asset_categories (CategoryId),
  CONSTRAINT fk_assets_loc FOREIGN KEY (LocationId) REFERENCES locations (LocationId),
  CONSTRAINT fk_assets_dept FOREIGN KEY (DepartmentId) REFERENCES departments (DepartmentId),
  CONSTRAINT fk_assets_proj FOREIGN KEY (ProjectId) REFERENCES projects (ProjectId),
  CONSTRAINT fk_assets_supplier FOREIGN KEY (SupplierId) REFERENCES suppliers (SupplierId),
  CONSTRAINT fk_assets_manufacturer FOREIGN KEY (ManufacturerId) REFERENCES manufacturers (ManufacturerId),
  CONSTRAINT fk_assets_country FOREIGN KEY (CountryOfOriginId) REFERENCES countries (CountryId),
  CONSTRAINT fk_assets_maint FOREIGN KEY (MaintenanceScheduleId) REFERENCES maintenance_schedules (MaintenanceScheduleId)
);

CREATE TABLE IF NOT EXISTS asset_assignments (
  AssignmentId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  AssetId INT NOT NULL,
  UserId INT NOT NULL,
  Notes VARCHAR(500) NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'open',
  AssignedBy INT NULL,
  AssignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  ClosedAt DATETIME NULL,
  ClosedBy INT NULL,
  KEY idx_assign_open (OrganizationId, AssetId, Status),
  CONSTRAINT fk_assign_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId),
  CONSTRAINT fk_assign_asset FOREIGN KEY (AssetId) REFERENCES assets (AssetId),
  CONSTRAINT fk_assign_user FOREIGN KEY (UserId) REFERENCES users (UserId)
);

CREATE TABLE IF NOT EXISTS asset_lifecycle_events (
  EventId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  AssetId INT NOT NULL,
  EventType VARCHAR(40) NOT NULL,
  PreviousValue VARCHAR(180) NULL,
  NewValue VARCHAR(180) NULL,
  Notes VARCHAR(500) NULL,
  CreatedBy INT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_life_asset (OrganizationId, AssetId, CreatedAt),
  CONSTRAINT fk_life_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId),
  CONSTRAINT fk_life_asset FOREIGN KEY (AssetId) REFERENCES assets (AssetId)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  AuditId INT AUTO_INCREMENT PRIMARY KEY,
  OrganizationId INT NOT NULL,
  UserId INT NULL,
  Action VARCHAR(60) NOT NULL,
  EntityType VARCHAR(60) NOT NULL,
  EntityId INT NULL,
  BeforeJson JSON NULL,
  AfterJson JSON NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_org (OrganizationId, CreatedAt),
  CONSTRAINT fk_audit_org FOREIGN KEY (OrganizationId) REFERENCES organizations (OrganizationId)
);
