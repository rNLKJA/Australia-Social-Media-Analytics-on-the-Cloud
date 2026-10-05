export const SITE = {
  name: "Social Sense",
  title: "Social Sense: how Victoria felt online, revisited",
  description:
    "A revived COMP90024 (University of Melbourne, 2023) cloud analytics project: 2.4 million geotagged tweets and 1.7 million Mastodon toots scored for sentiment and compared with official income and crime statistics.",
  repo: "https://github.com/rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud",
  subject: "COMP90024 Cluster and Cloud Computing",
  university: "The University of Melbourne",
  term: "Semester 1, 2023",
  team: "Team 57",
} as const;

export const NAV = [
  { href: "/twitter", label: "Sentiment map", short: "Map" },
  { href: "/income", label: "Income", short: "Income" },
  { href: "/crime", label: "Crime", short: "Crime" },
  { href: "/mastodon", label: "Mastodon", short: "Mastodon" },
  { href: "/pipeline", label: "Try the pipeline", short: "Pipeline" },
  { href: "/methods", label: "Data & methods", short: "Methods" },
  { href: "/records", label: "Records", short: "Records" },
] as const;

export const TEAM = [
  { name: "Sunchuangyu (Rin) Huang", role: "Frontend lead; data processing and API tools" },
  { name: "Xuan Wang", role: "CouchDB cluster; Ansible automation" },
  { name: "Wei Zhao", role: "Flask backend; Ansible automation" },
  { name: "Zongchao Xie", role: "Scenario analysis; data processing" },
  { name: "Runqiu Fei", role: "Data processing; database" },
] as const;
