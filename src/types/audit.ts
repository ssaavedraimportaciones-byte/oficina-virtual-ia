export type AuditAccion =
  | 'CREATE' | 'READ' | 'UPDATE' | 'SIGN'
  | 'APPROVE' | 'REJECT' | 'STAMP' | 'ARCHIVE'
  | 'REVERT' | 'LOGIN' | 'LOGOUT'
  | 'DELETE_ATTEMPT' | 'ACCESS_DENIED'
