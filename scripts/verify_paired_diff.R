# Reference values for pairedDifferenceScoreCi (web/src/lib/stats/multiple.ts):
# Tango's score interval for the difference of two paired proportions, as
# implemented by R's PropCIs package (scoreci.mp). The benchmark page uses it
# for "accuracy of run A minus run B" on the same questions.
#
# PropCIs::scoreci.mp(b, c, n) returns the interval for (c - b) / n, so it is
# called with the discordant counts swapped to get (onlyA - onlyB) / n.
#
# Run (PropCIs is pure R; install it once, e.g. into a temporary library):
#   Rscript -e 'install.packages("PropCIs", lib = "/tmp/rlib", repos = "https://cloud.r-project.org")'
#   R_LIBS=/tmp/rlib Rscript scripts/verify_paired_diff.R
# Writes web/src/lib/__fixtures__/paired-diff-parity.json.

suppressPackageStartupMessages(library(PropCIs))

args <- commandArgs(trailingOnly = FALSE)
here <- dirname(normalizePath(sub("^--file=", "", args[grep("^--file=", args)])))
out <- file.path(here, "..", "web", "src", "lib", "__fixtures__", "paired-diff-parity.json")

# (onlyA, onlyB, pairs): small benchmark-sized tables, ties, zeros and the edges
cases <- list(
  c(7, 0, 14), c(0, 7, 14), c(0, 0, 14), c(3, 2, 14), c(1, 0, 14), c(0, 1, 14),
  c(5, 5, 16), c(13, 1, 14), c(14, 0, 14), c(0, 14, 14), c(2, 9, 20), c(10, 3, 50),
  c(4, 1, 28), c(6, 2, 42), c(1, 1, 2), c(25, 12, 200)
)
levels <- c(0.95, 0.9)

rows <- character(0)
for (lv in levels) {
  for (x in cases) {
    ci <- scoreci.mp(x[2], x[1], x[3], lv)$conf.int
    rows <- c(rows, sprintf("[%d,%d,%d,%.2f,%.17g,%.17g]", x[1], x[2], x[3], lv, ci[1], ci[2]))
  }
}
json <- sprintf(
  '{"source":"R %s, PropCIs %s, scoreci.mp","columns":["onlyA","onlyB","n","level","lower","upper"],"cases":[%s]}',
  paste(R.version$major, R.version$minor, sep = "."),
  as.character(packageVersion("PropCIs")),
  paste(rows, collapse = ",")
)
writeLines(json, out)
cat("wrote", normalizePath(out), "\n")
