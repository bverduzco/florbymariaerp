-- AlterTable
ALTER TABLE "Material" ADD COLUMN "estimatedLifetimeDays" REAL;
ALTER TABLE "Material" ADD COLUMN "materialType" TEXT;
ALTER TABLE "Material" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Material" ADD COLUMN "preferredSupplier" TEXT;
ALTER TABLE "Material" ADD COLUMN "status" TEXT;
ALTER TABLE "Material" ADD COLUMN "stockValue" REAL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "flowersMultiplierCost" REAL;
ALTER TABLE "Product" ADD COLUMN "laborCost" REAL;
ALTER TABLE "Product" ADD COLUMN "laborDesignSurcharge" REAL;
ALTER TABLE "Product" ADD COLUMN "laborMinutes" REAL;
ALTER TABLE "Product" ADD COLUMN "marginAmount" REAL;
ALTER TABLE "Product" ADD COLUMN "materialsMultiplierCost" REAL;
ALTER TABLE "Product" ADD COLUMN "overheadPerUnit" REAL;
ALTER TABLE "Product" ADD COLUMN "suggestedPrice4xBeforeIva" REAL;
ALTER TABLE "Product" ADD COLUMN "suggestedPrice4xWithIva" REAL;

-- AlterTable
ALTER TABLE "RecipeLine" ADD COLUMN "effectiveFrom" DATETIME;
ALTER TABLE "RecipeLine" ADD COLUMN "sourceRowKey" TEXT;
ALTER TABLE "RecipeLine" ADD COLUMN "version" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "lastOrderAt" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "lifetimeValue" REAL;
ALTER TABLE "Customer" ADD COLUMN "recordedEventCount" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "recordedEventRevenue" REAL;
ALTER TABLE "Customer" ADD COLUMN "recordedOrderCount" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "recordedOrderRevenue" REAL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "sourceOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "sourceStatus" TEXT;

-- AlterTable
ALTER TABLE "OrderLineItem" ADD COLUMN "legacyLineKey" TEXT;
ALTER TABLE "OrderLineItem" ADD COLUMN "lineCost" REAL;
ALTER TABLE "OrderLineItem" ADD COLUMN "lineTotal" REAL;
ALTER TABLE "OrderLineItem" ADD COLUMN "profit" REAL;
ALTER TABLE "OrderLineItem" ADD COLUMN "sourceRowKey" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDeliveryDate" DATETIME;
ALTER TABLE "PurchaseOrder" ADD COLUMN "orderDate" DATETIME;
ALTER TABLE "PurchaseOrder" ADD COLUMN "sourceStatus" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "legacyLineKey" TEXT;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "sourceRowKey" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "balanceDue" REAL;
ALTER TABLE "Event" ADD COLUMN "clientName" TEXT;
ALTER TABLE "Event" ADD COLUMN "deliveryFee" REAL;
ALTER TABLE "Event" ADD COLUMN "depositPaid" REAL;
ALTER TABLE "Event" ADD COLUMN "estimatedProfit" REAL;
ALTER TABLE "Event" ADD COLUMN "estimatedTotalCost" REAL;
ALTER TABLE "Event" ADD COLUMN "estimatedTotalPrice" REAL;
ALTER TABLE "Event" ADD COLUMN "sourceEventId" TEXT;
ALTER TABLE "Event" ADD COLUMN "sourceStatus" TEXT;

-- CreateTable
CREATE TABLE "EventLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "lineTotal" REAL,
    "lineCost" REAL,
    "legacyLineKey" TEXT,
    "sourceRowKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLineItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT,
    "materialSku" TEXT NOT NULL,
    "movedAt" DATETIME,
    "packs" REAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'other',
    "reference" TEXT,
    "notes" TEXT,
    "sourceRowKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT,
    "materialSku" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "recordedAt" DATETIME,
    "packPrice" REAL,
    "unitsPerPack" REAL,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sourceRowKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPrice_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "availableFrom" DATETIME NOT NULL,
    "availableUntil" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "source" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialAvailability_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialSubstitution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "substituteMaterialId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialSubstitution_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialSubstitution_substituteMaterialId_fkey" FOREIGN KEY ("substituteMaterialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolsEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "quantity" REAL NOT NULL DEFAULT 0,
    "condition" TEXT,
    "location" TEXT,
    "purchasedAt" DATETIME,
    "purchasedFrom" TEXT,
    "purchaseCost" REAL,
    "lastServicedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "priceBeforeIva" REAL,
    "priceWithIva" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkbookSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "section" TEXT,
    "value" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkbookVersionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRowKey" TEXT NOT NULL,
    "version" TEXT,
    "recordedAt" DATETIME,
    "author" TEXT,
    "summary" TEXT,
    "fileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRowKey" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" DATETIME,
    "status" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "EventLineItem_sourceRowKey_key" ON "EventLineItem"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_sourceRowKey_key" ON "StockMovement"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPrice_sourceRowKey_key" ON "SupplierPrice"("sourceRowKey");

-- CreateIndex
CREATE INDEX "MaterialAvailability_materialId_availableFrom_availableUntil_idx" ON "MaterialAvailability"("materialId", "availableFrom", "availableUntil");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialSubstitution_materialId_substituteMaterialId_key" ON "MaterialSubstitution"("materialId", "substituteMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolsEquipment_sku_key" ON "ToolsEquipment"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_item_key" ON "MenuItem"("item");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbookSetting_key_key" ON "WorkbookSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbookVersionHistory_sourceRowKey_key" ON "WorkbookVersionHistory"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_sourceRowKey_key" ON "RecipeVersion"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeLine_sourceRowKey_key" ON "RecipeLine"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalId_key" ON "Customer"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_sourceOrderId_key" ON "Order"("sourceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineItem_sourceRowKey_key" ON "OrderLineItem"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_sourceRowKey_key" ON "PurchaseOrderLine"("sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_sourceEventId_key" ON "Event"("sourceEventId");
