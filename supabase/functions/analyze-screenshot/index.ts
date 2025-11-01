import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { screenshot_url, screenshot_id, team_id } = await req.json();

    if (!screenshot_url || !screenshot_id || !team_id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns this team
    const { data: session, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('team_id')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session || session.team_id !== team_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden - You can only analyze screenshots for your own team" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing screenshot:", screenshot_url);

    // Call Lovable AI to analyze the screenshot
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this PUBG match results screenshot and extract:

1. PLACEMENT (rank): Look for the placement number, usually shown as "#2" or "2nd place" or similar. This is typically displayed prominently at the top of the screen. The placement should be a number from 1 to 18.

2. TOTAL TEAM KILLS: This screenshot may show kills in different ways:
   - If you see a detailed stats table with an "Eliminations" column, sum up all the eliminations for all team members
   - If you see player cards at the bottom with individual elimination numbers, sum those up
   - If you see "Eliminations: X" anywhere, use that total
   - The kills could be labeled as "Eliminations", "Kills", or shown with a number

Important: 
- For kills/eliminations, you need to add up ALL team members' kills to get the total
- Look carefully at the entire screenshot to find where the kill information is displayed
- The placement is usually shown with a large "#" symbol followed by the rank number

Return the total team placement and total team kills.`
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshot_url
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_match_data",
              description: "Extract placement rank and kills from PUBG match screenshot",
              parameters: {
                type: "object",
                properties: {
                  placement: {
                    type: "integer",
                    description: "The team's placement/rank in the match (1-18)"
                  },
                  kills: {
                    type: "integer",
                    description: "Total number of kills in the match"
                  }
                },
                required: ["placement", "kills"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_match_data" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI Response:", JSON.stringify(aiData));

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const matchData = JSON.parse(toolCall.function.arguments);
    const { placement, kills } = matchData;

    console.log("Extracted data:", { placement, kills });

    // Calculate points
    const PLACEMENT_POINTS: Record<number, number> = {
      1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
    };
    const placementPoints = PLACEMENT_POINTS[placement] || 0;
    const killPoints = kills;
    const totalPoints = placementPoints + killPoints;

    // Use the same supabase client initialized earlier
    const supabase = supabaseClient;

    // Update the screenshot record
    const { error: updateError } = await supabase
      .from("match_screenshots")
      .update({
        placement,
        kills,
        points: totalPoints
      })
      .eq("id", screenshot_id);

    if (updateError) {
      console.error("Error updating screenshot:", updateError);
      throw new Error("Failed to update screenshot data");
    }

    // Fetch all screenshots for this team
    const { data: teamScreenshots, error: fetchError } = await supabase
      .from("match_screenshots")
      .select("*")
      .eq("team_id", team_id);

    if (fetchError) {
      console.error("Error fetching team screenshots:", fetchError);
      throw new Error("Failed to fetch team data");
    }

    // Calculate team stats
    const totalTeamPoints = teamScreenshots.reduce((sum, s) => sum + (s.points || 0), 0);
    const totalPlacementPoints = teamScreenshots.reduce((sum, s) => {
      const p = s.placement || 0;
      const pts = PLACEMENT_POINTS[p] || 0;
      return sum + pts;
    }, 0);
    const totalKills = teamScreenshots.reduce((sum, s) => sum + (s.kills || 0), 0);
    const totalKillPoints = totalKills;
    const matchesPlayed = teamScreenshots.length;
    const firstPlaceWins = teamScreenshots.filter(s => s.placement === 1).length;

    // Update team stats
    const { error: teamUpdateError } = await supabase
      .from("teams")
      .update({
        total_points: totalTeamPoints,
        placement_points: totalPlacementPoints,
        kill_points: totalKillPoints,
        total_kills: totalKills,
        matches_played: matchesPlayed,
        first_place_wins: firstPlaceWins
      })
      .eq("id", team_id);

    if (teamUpdateError) {
      console.error("Error updating team stats:", teamUpdateError);
      throw new Error("Failed to update team stats");
    }

    return new Response(
      JSON.stringify({
        success: true,
        placement,
        kills,
        points: totalPoints
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-screenshot function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
