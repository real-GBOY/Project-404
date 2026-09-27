import { ArrowLink, Reveal } from "../components/ui";
import { Icon } from "../components/icon";
import { blogSection, posts } from "../data";

export function Blog() {
  return (
    <section id="blog" className="pb-20 md:pb-24 lg:pb-32">
      <Reveal className="px-side">
        <div className="flex flex-wrap items-center justify-between">
          <h3 className="display-3 text-center">{blogSection.title}</h3>
          <ArrowLink href={blogSection.cta.href} className="mt-4">
            {blogSection.cta.label}
          </ArrowLink>
        </div>

        {/* Fixed card shape (near-square tiles); the wide post fills its row on desktop. */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.title}
              className={`group relative aspect-[1044/1106] overflow-hidden rounded-2xl ${post.wide ? "lg:col-span-2 lg:aspect-auto" : ""}`}
            >
              <img
                src={post.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full rounded-2xl object-cover transition-all duration-500 ease-in-out group-hover:scale-110 group-hover:opacity-50"
              />
              {/* Soft cream fade keeps the dark title readable on any photo. */}
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-secondary/95 via-secondary/60 to-transparent" />
              <div className={`absolute bottom-0 ${post.wide ? "p-6" : "p-6 lg:p-8 2xl:p-12"}`}>
                <span className="rounded-md bg-secondary px-2 py-1 text-body">{post.tag}</span>
                <h4 className="display-6 mt-2">
                  {/* Stretched link: the whole card is clickable, the title stays the accessible name. */}
                  <a href="#blog" className="after:absolute after:inset-0">
                    {post.title}
                  </a>
                </h4>
                <p className="mb-0 flex items-center gap-1">
                  <Icon name="clock" size={19} />
                  <time>{post.date}</time>
                </p>
              </div>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
