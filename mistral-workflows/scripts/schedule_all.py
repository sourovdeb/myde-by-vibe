"""Create schedules from OUTSIDE the worker (decorator schedules= is deprecated per docs).
Default is a DRY RUN that only prints the plan. Pass --apply to create schedules.
Requires MISTRAL_API_KEY in env and deployed workflows. Times are Indian/Reunion (UTC+4)."""
import asyncio
from mistralai.client import Mistral, models

TZ = "Indian/Reunion"

SCHEDULES = {
    # weekly content batch, Monday 09:00
    "content-scheduler": models.ScheduleDefinition(
        input={"batch_size": 7, "plant_typos": 0}, cron_expressions=["0 9 * * 1"], time_zone_name=TZ,
        policy=models.SchedulePolicy(overlap=models.ScheduleOverlapPolicy.SKIP, pause_on_failure=True,
                                     catchup_window_seconds=86400)),
    # weekly WordPress maintenance, Tuesday 02:00 (low traffic) with 20 min jitter
    "wordpress-maintainer": models.ScheduleDefinition(
        input={"mode": "weekly"}, cron_expressions=["0 2 * * 2"], time_zone_name=TZ, jitter="PT20M",
        policy=models.SchedulePolicy(overlap=models.ScheduleOverlapPolicy.SKIP, pause_on_failure=True)),
    # monthly deep audit, 1st of month 03:00
    "wordpress-maintainer#monthly": models.ScheduleDefinition(
        input={"mode": "monthly"}, cron_expressions=["0 3 1 * *"], time_zone_name=TZ,
        policy=models.SchedulePolicy(overlap=models.ScheduleOverlapPolicy.SKIP)),
}


async def main():
    import sys
    if "--apply" not in sys.argv:
        for key, sched in SCHEDULES.items():
            print(f"[dry run] {key}: {sched.cron_expressions} {TZ}")
        print("Nothing created. Re-run with --apply.")
        return
    from shared.config import load_env, require
    load_env()
    client = Mistral(api_key=require("MISTRAL_API_KEY"))
    for key, sched in SCHEDULES.items():
        name = key.split("#")[0]
        r = await client.workflows.schedules.schedule_workflow(workflow_identifier=name, schedule=sched)
        print(key, r.schedule_id)

if __name__ == "__main__":
    asyncio.run(main())
