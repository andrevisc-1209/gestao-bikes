export type BikeStatus = 'pending' | 'active' | 'inactive';
export type IncidentStatus = 'open' | 'resolved';

export interface CondoSettings {
  id: string;
  condo_name: string;
  total_capacity: number;
  next_tag_number: number;
}

export interface Bike {
  id: string;
  tag_number: string | null;
  unit_block: string;
  owner_name: string;
  owner_whatsapp: string;
  brand_model: string;
  color: string;
  photo_url: string | null;
  status: BikeStatus;
  created_at: string;
}

// Exactly the columns get_public_bike_by_tag returns — never widen this type.
export interface PublicBike {
  id: string;
  tag_number: string;
  brand_model: string;
  color: string;
  photo_url: string | null;
}

export interface Incident {
  id: string;
  bike_id: string;
  reason: string;
  notes: string | null;
  photo_url: string | null;
  reporter_info: string | null;
  status: IncidentStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface Sticker {
  tag_number: string;
  status: 'available' | 'assigned';
  bike_id: string | null;
  created_at: string;
}
