-- ============================================
-- APPOINTMENTS SCHEDULER MIGRATION
-- ============================================

BEGIN;

-- 1. Create Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable: Patient might book directly
    patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,   -- Nullable: Offline patient might not have account
    
    patient_name TEXT NOT NULL, -- Required for both online (snapshot) and offline
    patient_phone TEXT,
    
    appointment_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected')),
    type TEXT DEFAULT 'online' CHECK (type IN ('online', 'offline')),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1b. Schema Repair (Ensure columns exist if table was created previously without them)
DO $$
BEGIN
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name TEXT;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone TEXT;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_time TIMESTAMPTZ;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'));
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'online' CHECK (type IN ('online', 'offline'));
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assistant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    -- Ensure nullable for offline/assistant bookings
    ALTER TABLE appointments ALTER COLUMN patient_id DROP NOT NULL;
    ALTER TABLE appointments ALTER COLUMN assistant_id DROP NOT NULL;
END $$;

-- 1c. Ensure Constraints are correct (Recreate them)
-- First, sanitize any data that violates the new constraints
UPDATE appointments SET status = 'pending' WHERE status NOT IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected');
UPDATE appointments SET type = 'online' WHERE type NOT IN ('online', 'offline');

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'));

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_type_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_type_check CHECK (type IN ('online', 'offline'));

-- 2. Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (Drop first for idempotency)
DROP POLICY IF EXISTS "Doctors manage their appointments" ON appointments;
DROP POLICY IF EXISTS "Assistants manage their doctors appointments" ON appointments;
DROP POLICY IF EXISTS "Patients view and create their own appointments" ON appointments;

-- Policy: Doctors (Full Access to own)
CREATE POLICY "Doctors manage their appointments"
ON appointments
FOR ALL
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- Policy: Assistants (Full Access if linked to doctor)
CREATE POLICY "Assistants manage their doctors appointments"
ON appointments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = appointments.doctor_id
        AND da.assistant_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM doctor_assistants da
        WHERE da.doctor_id = appointments.doctor_id
        AND da.assistant_id = auth.uid()
    )
);

-- Policy: Patients (Insert Request, View Own)
CREATE POLICY "Patients view and create their own appointments"
ON appointments
FOR ALL
USING (auth.uid() = patient_id) -- View own
WITH CHECK (auth.uid() = patient_id); -- Create own


-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

COMMIT;
