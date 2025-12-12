import { auth } from "./firebase";
import { type User } from "firebase/auth";

const API_BASE = "/v1";

let cloudflareToken: string | null = null;

export async function exchangeToken(user: User) {
  try {
    const firebaseToken = await user.getIdToken();
    const res = await fetch(`${API_BASE}/exchange-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firebaseToken}`,
      },
      body: JSON.stringify({
        firebaseUid: user.uid,
        email: user.email,
        name: user.displayName,
      }),
    });

    if (!res.ok) {
      throw new Error("Token exchange failed");
    }

    const data = await res.json();
    cloudflareToken = data.cloudflareToken;
    return cloudflareToken;
  } catch (error) {
    console.error("Failed to exchange token", error);
    return null;
  }
}

async function getAuthHeaders() {
  if (!cloudflareToken && auth.currentUser) {
    await exchangeToken(auth.currentUser);
  }
  
  return {
    Authorization: `Bearer ${cloudflareToken}`,
    "Content-Type": "application/json",
  };
}

export interface UserData {
  email: string;
  monthlyUsage: number;
  dailyUsage: number;
  monthlyLimit: number;
  dailyLimit: number;
  lastActive?: string;
}

export interface DashboardData {
  users: number;
  activeToday: number;
  totalRequests: number;
  avgTokens: number;
  userList: UserData[];
  systemLimits: {
    monthly: number;
    daily: number;
  };
}

export async function updateUserLimit(email: string, monthly: number, daily: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/user-limit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, monthly, daily })
  });
  if (!res.ok) throw new Error("Failed to update limit");
  return res.json();
}

export async function updateGlobalLimits(monthly: number, daily: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/global-limits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ monthly, daily })
  });
  if (!res.ok) throw new Error("Failed to update global limits");
  return res.json();
}

export async function deleteUser(email: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/user-delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error("Failed to delete user");
  return res.json();
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/dashboard`, { headers });
    if (!res.ok) throw new Error("Failed to fetch");
    
    const data = await res.json();
    // data.users is array of { id, email, name, usage, month, lastActive }
    
    // Transform to DashboardData
    const userList: UserData[] = data.users.map((u: any) => ({
      email: u.email,
      monthlyUsage: u.usage,
      dailyUsage: u.dailyUsage || 0,
      monthlyLimit: u.monthlyLimit || 50,
      dailyLimit: u.dailyLimit || 10,
      lastActive: u.lastActive
    }));

    const totalRequests = userList.reduce((acc, u) => acc + u.monthlyUsage, 0);
    
    // Count active today (lastActive is ISO string)
    const today = new Date().toISOString().split('T')[0];
    const activeToday = userList.filter(u => u.lastActive && u.lastActive.startsWith(today)).length;

    return {
      users: userList.length,
      activeToday,
      totalRequests,
      avgTokens: 0,
      userList,
      systemLimits: data.systemLimits || { monthly: 50, daily: 10 }
    };
  } catch (e) {
    console.warn("API fetch failed, using mock data", e);
    // Fallback mock data for dev/demo if API fails
    return {
      users: 150,
      activeToday: 12,
      totalRequests: 3421,
      avgTokens: 156,
      userList: [
        { email: 'user1@example.com', monthlyUsage: 45, dailyUsage: 5, monthlyLimit: 100, dailyLimit: 10 },
        { email: 'user2@example.com', monthlyUsage: 78, dailyUsage: 8, monthlyLimit: 100, dailyLimit: 10 },
      ],
      systemLimits: {
        monthly: 50,
        daily: 10
      }
    };
  }
}
