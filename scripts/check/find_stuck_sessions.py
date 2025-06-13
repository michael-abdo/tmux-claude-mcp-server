#!/usr/bin/env python3

import subprocess
import json
import os
from datetime import datetime

# Target project IDs from the request
target_projects = [
    "021918433064331880504", "021919090362430743538", "021920099030637438030",
    "021921346257338424716", "021921831981138262614", "021922023501463108382",
    "021922290495470175836", "021922559710814724022", "021923422940263632391",
    "021923506750086859741", "021924483133534911842", "021924802648712635360",
    "021924892477838555910", "021925011782716318688", "021925205606226552673",
    "021926034442997674004", "021926792160461773798", "021926811470757658050",
    "021927921636963300407", "021928107942718286306", "021928185397395308311",
    "021928195057860950077", "021928286157852360471", "021928413009314635294",
    "021928449273731471567", "021928482916098586685", "021928513578612504637",
    "021928519552218421455", "021928542183218556892", "021928573181689388574",
    "021928602520267470909", "021928793827655663887", "021928837019223514654",
    "021929216949254564554", "021929248559911198238", "021929271473165905884",
    "021929284541023764393", "021929772896056498383", "021930356828589524220",
    "021901687678622429509", "021921696407555450084", "021924826200594882788",
    "021925242270015212411", "021929016736789551311", "021929582538724007454",
    "021929617332886009968", "021929684825916104222", "021929699342414831134",
    "021929701611683168169", "021929721942233831631", "021929830856825822750",
    "021929872883136738845", "021929944919006658321", "021929947185876948092",
    "021930015005142799484", "021930015207657257456", "021930023336535235424",
    "021930142766180193404", "021930181472995890300", "021930257392096132881",
    "021930263463044961405", "021930287495333139580", "021930313802153006803",
    "021930400348168455311", "021930438694037658687", "021930531716804018443",
    "021930622471472523063", "021930702079462637835", "021930966620528668750"
]

base_dir = "/Users/Mike/Desktop/programming/2_proposals/upwork"
spawn_script = "/Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js"

def check_project_status(project_id):
    """Check if a project has requirements, implementation, and session"""
    project_dir = os.path.join(base_dir, project_id)
    
    if not os.path.exists(project_dir):
        return None
    
    # Check for requirements
    has_requirements = (
        os.path.exists(os.path.join(project_dir, "instructions.md")) or
        os.path.exists(os.path.join(project_dir, "requirements.md"))
    )
    
    # Check for implementation
    impl_files = ["index.html", "main.py", "app.py", "server.py", "main.js", "style.css"]
    has_implementation = any(
        os.path.exists(os.path.join(project_dir, f)) for f in impl_files
    )
    
    # Check for session info
    session_info = None
    session_info_path = os.path.join(project_dir, ".tmux_session_info.json")
    if os.path.exists(session_info_path):
        try:
            with open(session_info_path) as f:
                session_info = json.load(f)
        except:
            pass
    
    return {
        "id": project_id,
        "dir": project_dir,
        "has_requirements": has_requirements,
        "has_implementation": has_implementation,
        "session_info": session_info
    }

def main():
    print("🔍 Analyzing target projects...\n")
    
    stuck_projects = []
    completed_projects = []
    no_requirements = []
    
    for project_id in target_projects:
        status = check_project_status(project_id)
        if not status:
            continue
        
        if status["has_requirements"] and not status["has_implementation"]:
            stuck_projects.append(status)
        elif status["has_implementation"]:
            completed_projects.append(project_id)
        elif not status["has_requirements"]:
            no_requirements.append(project_id)
    
    print(f"✅ Completed projects: {len(completed_projects)}")
    print(f"🚨 Stuck projects: {len(stuck_projects)}")
    print(f"⚪ No requirements: {len(no_requirements)}\n")
    
    if stuck_projects:
        print("🚨 STUCK PROJECTS TO RESTART:\n")
        
        # First 10 projects to restart
        for proj in stuck_projects[:10]:
            req_file = "instructions.md" if os.path.exists(
                os.path.join(proj["dir"], "instructions.md")
            ) else "requirements.md"
            
            print(f"# Project: {proj['id']}")
            
            if proj["session_info"]:
                print(f"# Kill existing session")
                print(f"tmux kill-session -t {proj['session_info']['sessionId']} 2>/dev/null || true")
            
            print(f"# Restart project")
            print(f'node {spawn_script} --project-dir "{proj["dir"]}" --project-type web-app --requirements-file {req_file}')
            print()

if __name__ == "__main__":
    main()