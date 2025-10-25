import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const isLoggingIn = useRef(false);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !isLoggingIn.current) {
        navigate("/dashboard", { replace: true });
      }
    };
    
    checkSession();
  }, [navigate]);

  const handleAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accessCode.trim()) {
      toast.error("Please enter an access code");
      return;
    }

    setLoading(true);
    isLoggingIn.current = true;

    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) {
        toast.error("Authentication failed");
        isLoggingIn.current = false;
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error("Authentication failed");
        isLoggingIn.current = false;
        setLoading(false);
        return;
      }

      // Validate access code using secure database function
      const { data: codeData, error: codeError } = await supabase
        .rpc("validate_access_code", { _code: accessCode.trim().toUpperCase() });

      if (codeError || !codeData || codeData.length === 0) {
        await supabase.auth.signOut();
        toast.error("Invalid access code");
        isLoggingIn.current = false;
        setLoading(false);
        return;
      }

      const { role, team_id } = codeData[0];

      // Insert into user_roles first
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: role,
        });

      if (roleError) {
        await supabase.auth.signOut();
        toast.error("Failed to assign role");
        isLoggingIn.current = false;
        setLoading(false);
        return;
      }

      // Then create session
      const { error: sessionError } = await supabase
        .from("sessions")
        .insert({
          user_id: authData.user.id,
          role: role,
          team_id: team_id,
        });

      if (sessionError) {
        await supabase.auth.signOut();
        toast.error("Failed to create session");
        isLoggingIn.current = false;
        setLoading(false);
        return;
      }

      toast.success("Login successful!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error("An error occurred");
      isLoggingIn.current = false;
    } finally {
      setLoading(false);
      isLoggingIn.current = false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6 bg-card/90 backdrop-blur-sm border-border/50">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Trophy className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            PUBG Tournament
          </h1>
          <p className="text-muted-foreground">Enter your access code to continue</p>
        </div>

        <form onSubmit={handleAccessCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessCode">Access Code</Label>
            <Input
              id="accessCode"
              type="text"
              placeholder="Enter your code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-wider"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Enter Tournament"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Auth;
