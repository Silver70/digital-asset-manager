export interface OrgMembership {
  org_id: string;
  org_name: string;
  role: string;
}

export interface AuthState {
  user_id: string;
  email: string;
  orgs: OrgMembership[];
  active_org_id: string | null;
}
