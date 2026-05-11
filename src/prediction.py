# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json

class AIPredictionMarket(gl.Contract):
    question: str
    category: str
    resolution_url: str
    resolved: bool
    outcome: bool
    total_yes: u256
    total_no: u256
    yes_odds: str
    no_odds: str

    def __init__(self, question: str, category: str, resolution_url: str, yes_odds: str, no_odds: str):
        self.question = question
        self.category = category
        self.resolution_url = resolution_url
        self.resolved = False
        self.outcome = False
        self.total_yes = u256(0)
        self.total_no = u256(0)
        self.yes_odds = yes_odds
        self.no_odds = no_odds

    @gl.public.write.payable
    def bet_yes(self) -> str:
        assert not self.resolved, "Market already resolved"
        assert gl.message.value > u256(0), "Must send value"
        self.total_yes = self.total_yes + gl.message.value
        return "YES bet placed"

    @gl.public.write.payable
    def bet_no(self) -> str:
        assert not self.resolved, "Market already resolved"
        assert gl.message.value > u256(0), "Must send value"
        self.total_no = self.total_no + gl.message.value
        return "NO bet placed"

    @gl.public.write
    def resolve(self) -> str:
        assert not self.resolved, "Already resolved"

        def nondet() -> str:
            response = gl.nondet.web.get(self.resolution_url)
            web_data = response.body.decode("utf-8")
            p1 = "Category: " + self.category
            p2 = "Question: " + self.question
            p3 = "Evidence: " + web_data[:1500]
            p4 = "Reply only with valid JSON with two keys: outcome (boolean, true means YES wins) and can_resolve (boolean)"
            task = p1 + "\n" + p2 + "\n" + p3 + "\n" + p4
            result = gl.nondet.exec_prompt(task).replace("```json", "").replace("```", "").strip()
            parsed = json.loads(result)
            return json.dumps({"can_resolve": parsed["can_resolve"], "outcome": parsed["outcome"]}, sort_keys=True)

        result_json = json.loads(gl.eq_principle.strict_eq(nondet))

        if not result_json["can_resolve"]:
            return "Cannot resolve yet"

        self.resolved = True
        self.outcome = result_json["outcome"]
        if self.outcome:
            return "Resolved: YES"
        return "Resolved: NO"

    @gl.public.view
    def get_state(self) -> str:
        return json.dumps({
            "question": self.question,
            "category": self.category,
            "resolved": self.resolved,
            "outcome": self.outcome,
            "total_yes": int(self.total_yes),
            "total_no": int(self.total_no),
            "yes_odds": self.yes_odds,
            "no_odds": self.no_odds,
        })