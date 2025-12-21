-- ============================================
-- ASSISTANT MIGRATION (SAFE & IDEMPOTENT)
-- ============================================

BEGIN;

-- 1. Create Doctor-Assistants Mapping Table
-- Doctor ID is PK (One Doctor -> One Assistant)
-- Assistant ID is FK (One Assistant -> Many Doctors)
CREATE TABLE IF NOT EXISTS doctor_assistants (
    doctor_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id) 
);

-- RLS for doctor_assistants
ALTER TABLE doctor_assistants ENABLE ROW LEVEL SECURITY;

-- Drop existings policies on doctor_assistants to avoid conflicts
DROP POLICY IF EXISTS "Doctors manage their own assistant" ON doctor_assistants;
DROP POLICY IF EXISTS "Assistants view their doctors" ON doctor_assistants;

-- Doctors can manage their own assistant mapping
CREATE POLICY "Doctors manage their own assistant"
ON doctor_assistants
FOR ALL
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- Assistants can view their mappings
CREATE POLICY "Assistants view their doctors"
ON doctor_assistants
FOR SELECT
USING (auth.uid() = assistant_id);


-- 1b. Update Profiles RLS (Allow viewing linked profiles)
-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS "Doctors and Assistants can view linked profiles" ON profiles;

-- Existing schema restricts to "View Own". We need to expand this.
CREATE POLICY "Doctors and Assistants can view linked profiles"
ON profiles
FOR SELECT
USING (
    -- View own
    id = auth.uid()
    OR
    -- Doctor viewing their assistant
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = auth.uid() AND da.assistant_id = profiles.id
    )
    OR
    -- Assistant viewing their doctor
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.assistant_id = auth.uid() AND da.doctor_id = profiles.id
    )
);


-- INDEXES
CREATE INDEX IF NOT EXISTS idx_doctor_assistants_assistant_id ON doctor_assistants(assistant_id);



-- 2. Add Status to Prescriptions (Pending/Completed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescriptions' AND column_name = 'status') THEN
        ALTER TABLE prescriptions ADD COLUMN status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed'));
    END IF;
END $$;

-- INDEXES for Status
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_status ON prescriptions(doctor_id, status);


-- 3. Update Prescriptions RLS for Assistant Access
-- Drop existing restrictive policies first (Safe to run multiple times)
DROP POLICY IF EXISTS "Doctors can view own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors can insert own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors can update own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors can delete own prescriptions" ON prescriptions;

DROP POLICY IF EXISTS "Doctors and their Assistants can view prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors and Assistants can insert prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors and Assistants can update prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors and Assistants can delete prescriptions" ON prescriptions;

-- New Unified Policy for VIEWING
CREATE POLICY "Doctors and their Assistants can view prescriptions"
ON prescriptions
FOR SELECT
USING (
    -- User is the owner doctor
    auth.uid() = doctor_id
    OR 
    -- User is an assigned assistant for this doctor
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = prescriptions.doctor_id
        AND da.assistant_id = auth.uid()
    )
);

-- Policy for INSERTING
CREATE POLICY "Doctors and Assistants can insert prescriptions"
ON prescriptions
FOR INSERT
WITH CHECK (
    -- User is the owner doctor
    auth.uid() = doctor_id
    OR 
    -- User is an assigned assistant for this doctor
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = prescriptions.doctor_id
        AND da.assistant_id = auth.uid()
    )
);

-- Policy for UPDATING
CREATE POLICY "Doctors and Assistants can update prescriptions"
ON prescriptions
FOR UPDATE
USING (
    auth.uid() = doctor_id
    OR 
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = prescriptions.doctor_id
        AND da.assistant_id = auth.uid()
    )
);

-- Policy for DELETING
CREATE POLICY "Doctors and Assistants can delete prescriptions"
ON prescriptions
FOR DELETE
USING (
    auth.uid() = doctor_id
    OR 
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = prescriptions.doctor_id
        AND da.assistant_id = auth.uid()
    )
);


-- 4. Secure Function to Link Assistant
-- Drop first to allow signature changes if needed
DROP FUNCTION IF EXISTS link_assistant(text);

CREATE OR REPLACE FUNCTION link_assistant(assistant_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
    caller_id UUID := auth.uid();
    caller_role TEXT;
BEGIN
    -- Check if caller is a Doctor
    -- (Assuming 'profiles' table exists as widely used in codebase)
    SELECT role INTO caller_role FROM profiles WHERE id = caller_id;
    IF caller_role <> 'doctor' THEN
        RAISE EXCEPTION 'Only doctors can add assistants';
    END IF;

    -- Find user by email from auth.users
    SELECT id INTO target_user_id FROM auth.users WHERE email = assistant_email;
    
    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found. Ask assistant to sign up first.');
    END IF;

    -- Insert or Update mapping
    INSERT INTO doctor_assistants (doctor_id, assistant_id)
    VALUES (caller_id, target_user_id)
    ON CONFLICT (doctor_id) 
    DO UPDATE SET assistant_id = EXCLUDED.assistant_id;

    -- Update the target user's role to 'assistant'
    UPDATE profiles SET role = 'assistant' WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Assistant linked successfully');
END;
$$;

COMMIT;
