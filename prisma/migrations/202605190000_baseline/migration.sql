-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PermissionModule" AS ENUM ('CUSTOMERS', 'INQUIRIES', 'PRODUCTS', 'QUOTATIONS', 'ORDERS', 'PAYMENTS', 'DELIVERIES', 'DOCUMENTS', 'SALES_HISTORY', 'USERS', 'SETTINGS');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'EXPORT', 'APPROVE');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('USER_INVITED', 'USER_UPDATED', 'ROLE_CHANGED', 'PERMISSIONS_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'LOGIN_BLOCKED', 'CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'INQUIRY_CREATED', 'INQUIRY_UPDATED', 'INQUIRY_ASSIGNED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'QUOTATION_CREATED', 'QUOTATION_UPDATED', 'QUOTATION_CONVERTED_TO_ORDER', 'ORDER_CREATED', 'ORDER_UPDATED', 'PAYMENT_RECORDED', 'PAYMENT_VOIDED', 'DELIVERY_SCHEDULED', 'DELIVERY_UPDATED', 'DOCUMENT_CREATED', 'SETTINGS_UPDATED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "CustomerContactType" AS ENUM ('PHONE', 'VIBER', 'FACEBOOK_PROFILE', 'FACEBOOK_PAGE', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('FACEBOOK_MARKETPLACE', 'FACEBOOK_PAGE', 'MESSENGER', 'VIBER', 'WALK_IN', 'PHONE', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'QUOTED', 'CONVERTED_TO_ORDER', 'CLOSED', 'LOST');

-- CreateEnum
CREATE TYPE "InquiryPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationItemType" AS ENUM ('CATALOG_PRODUCT', 'CUSTOM_ITEM');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'SCHEDULED_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'DOWNPAYMENT_PAID', 'PARTIALLY_PAID', 'BALANCE_DUE_ON_DELIVERY', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentDueTiming" AS ENUM ('BEFORE_DELIVERY', 'UPON_DELIVERY', 'AFTER_DELIVERY');

-- CreateEnum
CREATE TYPE "OrderDeliveryStatus" AS ENUM ('NOT_SCHEDULED', 'SCHEDULED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSourceType" AS ENUM ('QUOTATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DOWNPAYMENT', 'PARTIAL_PAYMENT', 'FINAL_PAYMENT', 'DELIVERY_BALANCE_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'GCASH', 'CHECK', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryProviderType" AS ENUM ('IN_HOUSE', 'CUSTOMER_PICKUP', 'THIRD_PARTY', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTATION_PDF', 'ORDER_CONFIRMATION', 'INVOICE', 'PAYMENT_RECEIPT', 'OFFICIAL_RECEIPT', 'ACKNOWLEDGEMENT_RECEIPT', 'DELIVERY_RECEIPT', 'FINAL_ORDER_SUMMARY', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'GENERATED', 'VOIDED');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "phone" TEXT,
    "invitedById" UUID,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "module" "PermissionModule" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "actorId" UUID,
    "targetUserId" UUID,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "contactPersonName" TEXT,
    "notes" TEXT,
    "createdById" UUID,
    "assignedStaffId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "CustomerContactType" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "label" TEXT,
    "recipientName" TEXT,
    "phone" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "source" "InquirySource" NOT NULL,
    "sourceReference" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "priority" "InquiryPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "messageSummary" TEXT,
    "requestedItems" TEXT,
    "budgetRange" TEXT,
    "targetDeliveryDate" TIMESTAMP(3),
    "deliveryLocation" TEXT,
    "assignedStaffId" UUID,
    "createdById" UUID,
    "followUpAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "specifications" TEXT,
    "referencePrice" DECIMAL(12,2),
    "referenceCost" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "isWebsiteVisible" BOOLEAN NOT NULL DEFAULT false,
    "websiteSortOrder" INTEGER NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" UUID NOT NULL,
    "quotationNumber" TEXT,
    "customerId" UUID NOT NULL,
    "inquiryId" UUID,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "itemDiscountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quotationDiscountType" "DiscountType",
    "quotationDiscountValue" DECIMAL(12,2),
    "quotationDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "needsAssembly" BOOLEAN NOT NULL DEFAULT false,
    "salesInvoiceRequested" BOOLEAN NOT NULL DEFAULT false,
    "modeOfDelivery" TEXT,
    "deliveryMethod" TEXT,
    "paymentTerms" TEXT,
    "specialInstructions" TEXT,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "productId" UUID,
    "itemType" "QuotationItemType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "snapshotProductCode" TEXT,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "specifications" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItemImage" (
    "id" UUID NOT NULL,
    "quotationItemId" UUID NOT NULL,
    "sourceProductImageId" UUID,
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT,
    "quotationId" UUID,
    "customerId" UUID NOT NULL,
    "inquiryId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentDueTiming" "PaymentDueTiming",
    "paymentDueDate" TIMESTAMP(3),
    "deliveryStatus" "OrderDeliveryStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "customerDisplayNameSnapshot" TEXT NOT NULL,
    "customerTypeSnapshot" "CustomerType" NOT NULL,
    "companyNameSnapshot" TEXT,
    "contactPersonNameSnapshot" TEXT,
    "primaryContactSnapshot" JSONB,
    "billingAddressSnapshot" JSONB,
    "deliveryAddressSnapshot" JSONB,
    "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "itemDiscountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orderDiscountType" "DiscountType",
    "orderDiscountValue" DECIMAL(12,2),
    "orderDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCostAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossProfitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastPaymentAt" TIMESTAMP(3),
    "needsAssembly" BOOLEAN NOT NULL DEFAULT false,
    "salesInvoiceRequested" BOOLEAN NOT NULL DEFAULT false,
    "modeOfDelivery" TEXT,
    "deliveryMethod" TEXT,
    "paymentTerms" TEXT,
    "specialInstructions" TEXT,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "sourceType" "OrderSourceType" NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "quotationItemId" UUID,
    "productId" UUID,
    "itemType" "QuotationItemType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "snapshotProductCode" TEXT,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "specifications" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineCostTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemImage" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "sourceQuotationItemImageId" UUID,
    "sourceProductImageId" UUID,
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "paymentNumber" TEXT,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'PARTIAL_PAYMENT',
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod",
    "referenceNumber" TEXT,
    "payerName" TEXT,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "receiptGenerated" BOOLEAN NOT NULL DEFAULT false,
    "receivedById" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "deliveryNumber" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" TIMESTAMP(3),
    "scheduledTimeWindow" TEXT,
    "deliveryProviderType" "DeliveryProviderType",
    "deliveryProviderName" TEXT,
    "deliveryProviderReference" TEXT,
    "deliveryAddressSnapshot" JSONB,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "deliveryNotes" TEXT,
    "internalNotes" TEXT,
    "assignedStaffId" UUID,
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantityPlanned" DECIMAL(12,2) NOT NULL,
    "quantityDelivered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDocument" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "quotationId" UUID,
    "paymentId" UUID,
    "deliveryId" UUID,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "title" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "secureUrl" TEXT,
    "resourceType" TEXT,
    "format" TEXT,
    "bytes" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "generatedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_authUserId_key" ON "UserProfile"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "UserProfile_role_idx" ON "UserProfile"("role");

-- CreateIndex
CREATE INDEX "UserProfile_status_idx" ON "UserProfile"("status");

-- CreateIndex
CREATE INDEX "UserPermission_module_action_idx" ON "UserPermission"("module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_module_action_key" ON "UserPermission"("userId", "module", "action");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_targetUserId_idx" ON "ActivityLog"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE INDEX "AppSetting_key_idx" ON "AppSetting"("key");

-- CreateIndex
CREATE INDEX "AppSetting_updatedById_idx" ON "AppSetting"("updatedById");

-- CreateIndex
CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");

-- CreateIndex
CREATE INDEX "Customer_displayName_idx" ON "Customer"("displayName");

-- CreateIndex
CREATE INDEX "Customer_companyName_idx" ON "Customer"("companyName");

-- CreateIndex
CREATE INDEX "Customer_assignedStaffId_idx" ON "Customer"("assignedStaffId");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_archivedAt_idx" ON "Customer"("archivedAt");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- CreateIndex
CREATE INDEX "CustomerContact_type_idx" ON "CustomerContact"("type");

-- CreateIndex
CREATE INDEX "CustomerContact_value_idx" ON "CustomerContact"("value");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE INDEX "Inquiry_customerId_idx" ON "Inquiry"("customerId");

-- CreateIndex
CREATE INDEX "Inquiry_source_idx" ON "Inquiry"("source");

-- CreateIndex
CREATE INDEX "Inquiry_status_idx" ON "Inquiry"("status");

-- CreateIndex
CREATE INDEX "Inquiry_priority_idx" ON "Inquiry"("priority");

-- CreateIndex
CREATE INDEX "Inquiry_assignedStaffId_idx" ON "Inquiry"("assignedStaffId");

-- CreateIndex
CREATE INDEX "Inquiry_createdAt_idx" ON "Inquiry"("createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_followUpAt_idx" ON "Inquiry"("followUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_isWebsiteVisible_idx" ON "Product"("isWebsiteVisible");

-- CreateIndex
CREATE INDEX "Product_websiteSortOrder_idx" ON "Product"("websiteSortOrder");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_code_idx" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_isPrimary_idx" ON "ProductImage"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_inquiryId_idx" ON "Quotation"("inquiryId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_createdById_idx" ON "Quotation"("createdById");

-- CreateIndex
CREATE INDEX "Quotation_createdAt_idx" ON "Quotation"("createdAt");

-- CreateIndex
CREATE INDEX "Quotation_updatedAt_idx" ON "Quotation"("updatedAt");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationItem_productId_idx" ON "QuotationItem"("productId");

-- CreateIndex
CREATE INDEX "QuotationItem_itemType_idx" ON "QuotationItem"("itemType");

-- CreateIndex
CREATE INDEX "QuotationItem_sortOrder_idx" ON "QuotationItem"("sortOrder");

-- CreateIndex
CREATE INDEX "QuotationItemImage_quotationItemId_idx" ON "QuotationItemImage"("quotationItemId");

-- CreateIndex
CREATE INDEX "QuotationItemImage_sourceProductImageId_idx" ON "QuotationItemImage"("sourceProductImageId");

-- CreateIndex
CREATE INDEX "QuotationItemImage_isPrimary_idx" ON "QuotationItemImage"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_quotationId_key" ON "Order"("quotationId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_inquiryId_idx" ON "Order"("inquiryId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_paymentDueTiming_idx" ON "Order"("paymentDueTiming");

-- CreateIndex
CREATE INDEX "Order_paymentDueDate_idx" ON "Order"("paymentDueDate");

-- CreateIndex
CREATE INDEX "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");

-- CreateIndex
CREATE INDEX "Order_sourceType_idx" ON "Order"("sourceType");

-- CreateIndex
CREATE INDEX "Order_totalCostAmount_idx" ON "Order"("totalCostAmount");

-- CreateIndex
CREATE INDEX "Order_grossProfitAmount_idx" ON "Order"("grossProfitAmount");

-- CreateIndex
CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");

-- CreateIndex
CREATE INDEX "Order_lastPaymentAt_idx" ON "Order"("lastPaymentAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_updatedAt_idx" ON "Order"("updatedAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_quotationItemId_idx" ON "OrderItem"("quotationItemId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_itemType_idx" ON "OrderItem"("itemType");

-- CreateIndex
CREATE INDEX "OrderItem_sortOrder_idx" ON "OrderItem"("sortOrder");

-- CreateIndex
CREATE INDEX "OrderItemImage_orderItemId_idx" ON "OrderItemImage"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemImage_sourceQuotationItemImageId_idx" ON "OrderItemImage"("sourceQuotationItemImageId");

-- CreateIndex
CREATE INDEX "OrderItemImage_sourceProductImageId_idx" ON "OrderItemImage"("sourceProductImageId");

-- CreateIndex
CREATE INDEX "OrderItemImage_isPrimary_idx" ON "OrderItemImage"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_paymentType_idx" ON "Payment"("paymentType");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_receivedById_idx" ON "Payment"("receivedById");

-- CreateIndex
CREATE INDEX "Payment_createdById_idx" ON "Payment"("createdById");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");

-- CreateIndex
CREATE INDEX "Delivery_orderId_idx" ON "Delivery"("orderId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_scheduledDate_idx" ON "Delivery"("scheduledDate");

-- CreateIndex
CREATE INDEX "Delivery_deliveryProviderType_idx" ON "Delivery"("deliveryProviderType");

-- CreateIndex
CREATE INDEX "Delivery_assignedStaffId_idx" ON "Delivery"("assignedStaffId");

-- CreateIndex
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");

-- CreateIndex
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryItem_orderItemId_idx" ON "DeliveryItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDocument_documentNumber_key" ON "OrderDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "OrderDocument_orderId_idx" ON "OrderDocument"("orderId");

-- CreateIndex
CREATE INDEX "OrderDocument_quotationId_idx" ON "OrderDocument"("quotationId");

-- CreateIndex
CREATE INDEX "OrderDocument_paymentId_idx" ON "OrderDocument"("paymentId");

-- CreateIndex
CREATE INDEX "OrderDocument_deliveryId_idx" ON "OrderDocument"("deliveryId");

-- CreateIndex
CREATE INDEX "OrderDocument_documentType_idx" ON "OrderDocument"("documentType");

-- CreateIndex
CREATE INDEX "OrderDocument_status_idx" ON "OrderDocument"("status");

-- CreateIndex
CREATE INDEX "OrderDocument_createdAt_idx" ON "OrderDocument"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCounter_type_year_key" ON "DocumentCounter"("type", "year");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItemImage" ADD CONSTRAINT "QuotationItemImage_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "QuotationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItemImage" ADD CONSTRAINT "QuotationItemImage_sourceProductImageId_fkey" FOREIGN KEY ("sourceProductImageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "QuotationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemImage" ADD CONSTRAINT "OrderItemImage_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemImage" ADD CONSTRAINT "OrderItemImage_sourceQuotationItemImageId_fkey" FOREIGN KEY ("sourceQuotationItemImageId") REFERENCES "QuotationItemImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemImage" ADD CONSTRAINT "OrderItemImage_sourceProductImageId_fkey" FOREIGN KEY ("sourceProductImageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

