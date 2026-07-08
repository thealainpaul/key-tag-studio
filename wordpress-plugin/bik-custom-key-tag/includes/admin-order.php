<?php
/**
 * Order admin meta box: custom key tag design download / studio link.
 *
 * @package BIK_Custom_Key_Tag
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register meta box on shop order screens (classic + HPOS).
 */
function bik_ckt_add_order_meta_box() {
	$screens = array( 'shop_order', 'woocommerce_page_wc-orders' );
	foreach ( $screens as $screen ) {
		add_meta_box(
			'bik_ckt_design_box',
			__( 'Custom key tag design', 'bik-custom-key-tag' ),
			'bik_ckt_render_order_meta_box',
			$screen,
			'side',
			'default'
		);
	}
}
add_action( 'add_meta_boxes', 'bik_ckt_add_order_meta_box' );

/**
 * Resolve WC_Order from meta box context.
 *
 * @param WP_Post|WC_Order|null $post_or_order Context.
 * @return WC_Order|null
 */
function bik_ckt_resolve_order_from_metabox( $post_or_order ) {
	if ( $post_or_order instanceof WC_Order ) {
		return $post_or_order;
	}
	if ( isset( $_GET['id'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$order = wc_get_order( absint( $_GET['id'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( $order ) {
			return $order;
		}
	}
	if ( $post_or_order instanceof WP_Post ) {
		return wc_get_order( $post_or_order->ID );
	}
	global $post;
	if ( $post instanceof WP_Post ) {
		return wc_get_order( $post->ID );
	}
	return null;
}

/**
 * Render meta box contents.
 *
 * @param WP_Post|WC_Order $post_or_order Context.
 */
function bik_ckt_render_order_meta_box( $post_or_order ) {
	if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'edit_shop_orders' ) ) {
		return;
	}

	$order = bik_ckt_resolve_order_from_metabox( $post_or_order );
	if ( ! $order ) {
		echo '<p>' . esc_html__( 'Order not found.', 'bik-custom-key-tag' ) . '</p>';
		return;
	}

	$items = bik_ckt_get_order_design_items( $order );
	if ( empty( $items ) ) {
		echo '<p>' . esc_html__( 'No custom key tag design on this order.', 'bik-custom-key-tag' ) . '</p>';
		return;
	}

	foreach ( $items as $row ) {
		$design_id   = $row['design_id'];
		$preview_url = $row['preview_url'];
		$studio_url  = bik_ckt_studio_admin_design_url( $design_id );

		echo '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #ddd;">';
		echo '<p><strong>' . esc_html__( 'Design ID', 'bik-custom-key-tag' ) . ':</strong><br /><code>' . esc_html( $design_id ) . '</code></p>';
		echo '<p><strong>' . esc_html__( 'Qty', 'bik-custom-key-tag' ) . ':</strong> ' . esc_html( (string) $row['quantity'] ) . '</p>';

		if ( $preview_url ) {
			if ( 0 === strpos( $preview_url, 'data:image/' ) ) {
				echo '<p><img src="' . esc_attr( $preview_url ) . '" alt="" style="max-width:100%;height:auto;border-radius:4px;" /></p>';
				$download = wp_nonce_url(
					add_query_arg(
						array(
							'action'    => 'bik_ckt_download_preview',
							'order_id'  => $order->get_id(),
							'design_id' => $design_id,
						),
						admin_url( 'admin-post.php' )
					),
					'bik_ckt_download_' . $order->get_id() . '_' . $design_id
				);
				echo '<p><a class="button button-primary" href="' . esc_url( $download ) . '">' . esc_html__( 'Download preview', 'bik-custom-key-tag' ) . '</a></p>';
			} else {
				echo '<p><img src="' . esc_url( $preview_url ) . '" alt="" style="max-width:100%;height:auto;border-radius:4px;" /></p>';
				echo '<p><a class="button button-primary" href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Download preview', 'bik-custom-key-tag' ) . '</a></p>';
			}
		} else {
			echo '<p>' . esc_html__( 'No preview stored on this order line.', 'bik-custom-key-tag' ) . '</p>';
		}

		if ( $studio_url ) {
			echo '<p><a href="' . esc_url( $studio_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'View in studio admin', 'bik-custom-key-tag' ) . '</a></p>';
		}

		echo '</div>';
	}
}

/**
 * Admin-post handler: download data-URL preview as a file.
 */
function bik_ckt_handle_download_preview() {
	if ( ! current_user_can( 'edit_shop_orders' ) && ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'Unauthorized.', 'bik-custom-key-tag' ), 403 );
	}

	$order_id  = isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$design_id = isset( $_GET['design_id'] ) ? sanitize_text_field( wp_unslash( $_GET['design_id'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	if ( ! $order_id || ! $design_id ) {
		wp_die( esc_html__( 'Missing parameters.', 'bik-custom-key-tag' ), 400 );
	}

	check_admin_referer( 'bik_ckt_download_' . $order_id . '_' . $design_id );

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		wp_die( esc_html__( 'Order not found.', 'bik-custom-key-tag' ), 404 );
	}

	$preview_url = '';
	foreach ( bik_ckt_get_order_design_items( $order ) as $row ) {
		if ( $row['design_id'] === $design_id ) {
			$preview_url = $row['preview_url'];
			break;
		}
	}

	if ( '' === $preview_url || 0 !== strpos( $preview_url, 'data:image/' ) ) {
		wp_die( esc_html__( 'Preview not available for download.', 'bik-custom-key-tag' ), 404 );
	}

	if ( ! preg_match( '#^data:image/(png|jpeg|jpg|gif|webp);base64,#i', $preview_url, $m ) ) {
		wp_die( esc_html__( 'Invalid preview data.', 'bik-custom-key-tag' ), 400 );
	}

	$ext = strtolower( $m[1] );
	if ( 'jpeg' === $ext ) {
		$ext = 'jpg';
	}
	$b64  = substr( $preview_url, strpos( $preview_url, ',' ) + 1 );
	$data = base64_decode( $b64, true );
	if ( false === $data ) {
		wp_die( esc_html__( 'Could not decode preview.', 'bik-custom-key-tag' ), 500 );
	}

	$safe_id  = preg_replace( '/[^A-Za-z0-9_-]/', '', $design_id );
	$filename = 'bik-key-tag-' . $safe_id . '.' . $ext;

	nocache_headers();
	header( 'Content-Type: image/' . ( 'jpg' === $ext ? 'jpeg' : $ext ) );
	header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
	header( 'Content-Length: ' . (string) strlen( $data ) );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo $data;
	exit;
}
add_action( 'admin_post_bik_ckt_download_preview', 'bik_ckt_handle_download_preview' );
