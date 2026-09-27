-- OpenBlueprint Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Project table
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "buildingType" TEXT NOT NULL DEFAULT 'residential',
    "layoutData" TEXT,
    "configData" TEXT,
    "accentColor" TEXT,
    "thumbnail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- DesignVersion table
CREATE TABLE IF NOT EXISTS "DesignVersion" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layoutData" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AiConversation table
CREATE TABLE IF NOT EXISTS "AiConversation" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CostEstimate table
CREATE TABLE IF NOT EXISTS "CostEstimate" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "breakdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostEstimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "DesignVersion_projectId_idx" ON "DesignVersion"("projectId");
CREATE INDEX IF NOT EXISTS "AiConversation_projectId_idx" ON "AiConversation"("projectId");
CREATE INDEX IF NOT EXISTS "CostEstimate_projectId_idx" ON "CostEstimate"("projectId");
