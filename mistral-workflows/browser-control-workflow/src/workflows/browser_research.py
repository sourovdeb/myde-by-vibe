"""Browser Research workflow — uses the Browser Control MCP connector to
navigate Chrome, extract page content, and take screenshots."""

import pydantic
from mistralai import workflows
from mistralai.workflows import Depends
from mistralai.workflows.plugins.mistralai.connectors import (
    ToolCallClient,
    connector,
    uses_connectors,
)

browser = connector("browser_control_mcp_a498")
sysinfo = connector("system_info_mcp_4113")


class BrowserResearchInput(pydantic.BaseModel):
    url: str
    question: str = "Summarize what this page is about."


class BrowserResearchOutput(pydantic.BaseModel):
    page_title: str
    page_url: str
    dom_excerpt: str
    screenshot_path: str
    system_health: str


@workflows.activity(name="open-and-navigate")
async def open_and_navigate(
    url: str,
    client: ToolCallClient = Depends(browser),  # noqa: B008
) -> None:
    await client.call_tool(tool_name="browser_new_tab", arguments={"url": url})


@workflows.activity(name="get-page-info")
async def get_page_info(
    client: ToolCallClient = Depends(browser),  # noqa: B008
) -> str:
    result = await client.call_tool(tool_name="browser_get_page_info", arguments={})
    return str(result)


@workflows.activity(name="get-dom")
async def get_dom(
    client: ToolCallClient = Depends(browser),  # noqa: B008
) -> str:
    result = await client.call_tool(tool_name="browser_get_dom", arguments={})
    text = str(result)
    return text[:5000]


@workflows.activity(name="take-screenshot")
async def take_screenshot(
    path: str,
    client: ToolCallClient = Depends(browser),  # noqa: B008
) -> str:
    result = await client.call_tool(
        tool_name="browser_screenshot", arguments={"path": path}
    )
    return str(result)


@workflows.activity(name="check-system-health")
async def check_system_health(
    client: ToolCallClient = Depends(sysinfo),  # noqa: B008
) -> str:
    result = await client.call_tool(tool_name="health_check", arguments={})
    return str(result)


@workflows.workflow.define(
    name="browser-research",
    workflow_display_name="Browser Research",
    workflow_description=(
        "Navigate Chrome to a URL via the Browser Control MCP connector, "
        "extract page info and DOM content, take a screenshot, and check "
        "system health via the System Info MCP connector."
    ),
)
@uses_connectors(browser, sysinfo)
class BrowserResearchWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: BrowserResearchInput) -> BrowserResearchOutput:
        screenshot_path = "C:\\tmp\\browser-research-screenshot.png"

        await open_and_navigate(input.url)
        await get_page_info()
        dom = await get_dom()
        screenshot = await take_screenshot(screenshot_path)
        health = await check_system_health()

        return BrowserResearchOutput(
            page_title=input.url,
            page_url=input.url,
            dom_excerpt=dom,
            screenshot_path=screenshot,
            system_health=health,
        )
