import type {
  AuthResult,
  AuthStatus,
  LoginInput,
  RegisterInput,
} from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const authApi = {
  status: () => http.get<AuthStatus>('/auth/status'),
  register: (input: RegisterInput) => http.post<AuthResult>('/auth/register', input),
  login: (input: LoginInput) => http.post<AuthResult>('/auth/login', input),
};
