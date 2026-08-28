export interface NotifyShowRequest {
  title: string;
  body: string;
  kind: string;
}

export interface NotifyShowResponse {
  shown: boolean;
}
