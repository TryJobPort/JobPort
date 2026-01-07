// web/src/lib/mockImport.js
function pick(arr, i) {
  return arr[i % arr.length];
}

export function getMockImportedJobApplications(count = 42) {
  const companies = [
    "HarborWorks", "Anchor Labs", "BlueTide", "NorthStar Systems",
    "Keel & Co", "Lighthouse Data", "Seabright", "Harborline",
    "Portside AI", "Mariner Cloud", "SignalDock", "CompassOps",
  ];

  const roles = [
    "Product Manager", "Senior Product Manager", "UX Designer", "Software Engineer",
    "Data Analyst", "Customer Success Manager", "Program Manager",
  ];

  const portals = ["Greenhouse", "Lever", "Workday", "Indeed", "LinkedIn"];

  const statuses = ["Applied", "Under Review", "Interview", "Rejected"];

  const now = Date.now();

  const items = [];
  for (let i = 0; i < count; i++) {
    const company = pick(companies, i);
    const role = pick(roles, i + 2);
    const portal = pick(portals, i + 1);
    const status = pick(statuses, i);

    items.push({
      id: `mock_${i + 1}`,
      company,
      role,
      portal,
      status,
      url: "",
      last_bearing_at: new Date(now - (i + 1) * 3600_000).toISOString(),
      baseline_established_at: null,
      __mock: true,
    });
  }

  return items;
}
