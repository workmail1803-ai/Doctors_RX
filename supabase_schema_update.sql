-- Migration: Add Roles and Appointments Table
-- IDEMPOTENT SCRIPT (Safe to run multiple times)

-- 1. Modify Profiles Role Constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('doctor', 'assistant', 'patient'));

-- 2. Create Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID REFERENCES profiles(id) NOT NULL,
    doctor_id UUID REFERENCES profiles(id),
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    meeting_link TEXT, -- Optional: PeerID or URL
    doctor_peer_id TEXT, -- Signaling: Doctor's active PeerID
    patient_peer_id TEXT, -- Signaling: Patient's active PeerID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add columns if they don't exist (for updates)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'doctor_peer_id') THEN
        ALTER TABLE appointments ADD COLUMN doctor_peer_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'patient_peer_id') THEN
        ALTER TABLE appointments ADD COLUMN patient_peer_id TEXT;
    END IF;
END $$;

-- 3. RLS for Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid confusion/errors when re-running
DROP POLICY IF EXISTS "Patients view own appointments" ON appointments;
DROP POLICY IF EXISTS "Patients create appointments" ON appointments;
DROP POLICY IF EXISTS "Patients insert own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors view assigned appointments" ON appointments;
DROP POLICY IF EXISTS "Assistants view all appointments" ON appointments;
DROP POLICY IF EXISTS "Assistants update appointments" ON appointments;
DROP POLICY IF EXISTS "Participants update signaling" ON appointments;

-- Recreate Policies

-- Patient can view their own appointments
CREATE POLICY "Patients view own appointments" ON appointments
    FOR SELECT USING (auth.uid() = patient_id);

-- Patient can create appointments
CREATE POLICY "Patients insert own appointments" ON appointments
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Doctors can view appointments valid for them
CREATE POLICY "Doctors view assigned appointments" ON appointments
    FOR SELECT USING (auth.uid() = doctor_id);

-- Assistants can view ALL appointments
CREATE POLICY "Assistants view all appointments" ON appointments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'assistant')
    );

-- Assistants can update appointments
CREATE POLICY "Assistants update appointments" ON appointments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'assistant')
    );

-- Allow Doctor/Patient to update their signaling IDs (Peer Signal)
CREATE POLICY "Participants update signaling" ON appointments
    FOR UPDATE USING (
        auth.uid() = patient_id OR auth.uid() = doctor_id
    );

-- 4. RPC: Get Doctors
CREATE OR REPLACE FUNCTION get_active_doctors()
RETURNS TABLE(id UUID, full_name TEXT, clinic_details JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name, p.clinic_details
    FROM profiles p
    WHERE p.role = 'doctor';
END;
$$;

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 6. ENABLE REALTIME
-- This is crucial for the video call signaling to work
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
