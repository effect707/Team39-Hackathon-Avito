export interface SessionUser {
    id: string;
    name: string;
    login: string;
}

export interface StoredUser extends SessionUser {
    passwordHash: string;
}
