export interface Disease {
    name: string;
    days: string;
}

export interface Medicine {
    brand: string;
    dosage: string;
    freq: string;
    duration: string;
}

export interface Test {
    name: string;
    notes: string;
}

export interface AdviceItem {
    text: string;
}

export interface History {
    pastIllness: string;
    birthHistory: string;
    feedingHistory: string;
    developmentHistory: string;
    treatmentHistory: string;
    familyHistory: string;
}

export interface PatientInfo {
    age?: string;
    sex?: 'Male' | 'Female' | 'Other' | string;
    follow_up?: string;
    history?: History;
    history_visibility?: { [key in keyof History]?: boolean };
    examination?: string[];
    provisional_diagnosis?: string;
    bp?: string;
    weight?: string;
}

export interface Prescription {
    id: string;
    doctor_id: string;
    patient_name: string;
    patient_info: PatientInfo;
    diseases: Disease[];
    meds: Medicine[];
    tests: Test[];
    advice?: string;
    follow_up?: string;
    created_at: string;
}

export interface LayoutElement {
    x: number;
    y: number;
    visible?: boolean;
}

export interface LayoutConfig {
    // Header
    patient_name_el?: LayoutElement;
    age_el?: LayoutElement;
    sex_el?: LayoutElement;
    date_el?: LayoutElement;

    // Vitals
    bp_el?: LayoutElement;
    weight_el?: LayoutElement;
    examination_el?: LayoutElement;

    // Body
    complaints_el?: LayoutElement;
    history_el?: LayoutElement;
    tests_el?: LayoutElement;
    diagnosis_el?: LayoutElement; // Provis. Diagnosis / Notes

    // Rx
    medicines_el?: LayoutElement;
    advice_el?: LayoutElement;
    follow_up_el?: LayoutElement;

    // Footer
    signature_el?: LayoutElement;
}

export interface PrescriptionTemplate {
    id: string;
    doctor_id: string;
    background_pdf_path?: string;
    header_html?: string;
    footer_html?: string;
    css_overrides?: string;
    layout_config?: LayoutConfig; // New field
    is_default?: boolean;
    created_at: string;
}
