export interface EventsApiPayload {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event?: Event;
  type?: string;
  authed_users?: string[];
  event_id?: string;
  event_time?: number;
  challenge?: string; // url_verification
}

export interface Event {
  type?: string;
  [key: string]: any;
}