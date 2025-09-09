-- Create normalized personnel table for businesses
CREATE TABLE IF NOT EXISTS business_personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    identity TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    CHECK (role IN ('maintainer','sre','developer','tester','bizops'))
);

CREATE INDEX IF NOT EXISTS idx_business_personnel_business_id ON business_personnel(business_id);
CREATE INDEX IF NOT EXISTS idx_business_personnel_role ON business_personnel(role);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_personnel_identity_role ON business_personnel(business_id, identity, role);

