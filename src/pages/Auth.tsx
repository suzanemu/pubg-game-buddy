import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, Target, Shield } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Tactical Grid Background */}
      <div className="absolute inset-0 tactical-grid opacity-20"></div>
      
      {/* Animated Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Main Card */}
        <Card className="card-tactical p-8 space-y-8 backdrop-blur-sm border-2 border-border/50 hover-lift">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <div className="flex justify-center items-center gap-4 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative p-4 bg-gradient-primary rounded-full">
                  <Trophy className="h-12 w-12 text-background" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-5xl font-rajdhani font-bold">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  PUBG
                </span>
              </h1>
              <h2 className="text-2xl font-rajdhani font-semibold text-foreground/90">
                Tournament Manager
              </h2>
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Shield className="h-4 w-4" />
                <span>Secure Access Portal</span>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleAccessCode} className="space-y-6">
            <div className="space-y-3">
              <Label 
                htmlFor="accessCode" 
                className="text-sm font-rajdhani font-semibold uppercase tracking-wider flex items-center gap-2"
              >
                <Target className="h-4 w-4 text-primary" />
                Access Code
              </Label>
              <Input
                id="accessCode"
                type="text"
                placeholder="ENTER-CODE-HERE"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="text-center text-2xl font-rajdhani font-bold tracking-widest uppercase bg-secondary/50 border-2 border-border focus:border-primary transition-all h-14"
                disabled={loading}
                maxLength={20}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-rajdhani font-bold uppercase tracking-wider btn-glow bg-gradient-primary hover:opacity-90 transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-3 border-background/30 border-t-background rounded-full animate-spin"></div>
                  Authenticating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Enter Tournament
                </div>
              )}
            </Button>
          </form>

          {/* Footer Info */}
          <div className="pt-4 border-t border-border/30">
            <p className="text-xs text-center text-muted-foreground font-barlow">
              Authorized personnel only • Secure connection established
            </p>
          </div>
        </Card>

        {/* Bottom Accent Line */}
        <div className="mt-6 h-1 bg-gradient-primary rounded-full opacity-50"></div>
      </div>
    </div>
  );
};

export default Auth;
