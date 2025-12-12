import { auth } from "./firebase";
import { type User } from "firebase/auth";

const API_BASE = "/api";

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
      monthlyUsage: u.usage, // Assuming usage is monthly count
      dailyUsage: 0, // Backend doesn't provide daily usage yet
      monthlyLimit: 50, // Hardcoded limit from backend
      dailyLimit: 10, // Hardcoded
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
      avgTokens: 0, // Not available
      userList,
      systemLimits: {
        monthly: 10000,
        daily: 1000
      }
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
        monthly: 10000,
        daily: 1000
      }
    };
  }
}

export async function updateUser(email: string, data: Partial<UserData>) {
  console.log("Updating user", email, data);
  // Implementation for real API would go here
  // Backend needs an endpoint for this
}

export async function updateSystemLimits(data: { monthly: number; daily: number }) {
  console.log("Updating system limits", data);
  // Backend needs an endpoint for this
}

export async function addUser(email: string) {
    console.log("Adding user", email);
    // Backend needs an endpoint for this
}
