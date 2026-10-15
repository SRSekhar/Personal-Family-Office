const LOCAL_WORKSPACE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isPrivateWorkspaceAllowed(hostname) {
    if (typeof hostname !== 'string') return false;
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
    return LOCAL_WORKSPACE_HOSTS.has(normalized);
}
